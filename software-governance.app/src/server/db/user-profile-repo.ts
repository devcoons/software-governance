/* user-profile-repo.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import mysql from 'mysql2/promise'
import config from '@/config'

/* ---------------------------------------------------------------------- */

async function getPool() {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    connectTimeout: 3000,
  })
  return pool
}

/* ---------------------------------------------------------------------- */

function bufToUuid(b: any): string {
  if (!b) return ''
  if (typeof b === 'string') return b
  const hex = Buffer.isBuffer(b) ? b.toString('hex') : Buffer.from(b).toString('hex')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

/* ---------------------------------------------------------------------- */

export type DbUserProfile = Readonly<{
  user_id: string
  first_name: string
  last_name: string
  phone_number: string
  timezone: string
}>

/* ---------------------------------------------------------------------- */

function rowToUserProfile(row: any): DbUserProfile {
  return {
    user_id: bufToUuid(row.user_id),
    first_name: row.first_name ? String(row.first_name) : '',
    last_name: row.last_name ? String(row.last_name) : '',
    phone_number: row.phone_number ? String(row.phone_number) : '',
    timezone: row.timezone ? String(row.timezone) : '',
  }
}

/* ---------------------------------------------------------------------- */

async function readProfile(pool: mysql.Pool, userId: string): Promise<DbUserProfile | null> {
  const sql = `
    SELECT user_id, first_name, last_name, phone_number, timezone
    FROM user_profile
    WHERE user_id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
  `
  const [rows] = await pool.query(sql, [userId])
  const arr = rows as any[]
  if (!arr || arr.length === 0) return null
  return rowToUserProfile(arr[0])
}

/* ---------------------------------------------------------------------- */

export async function getUserProfileById(userId: string): Promise<DbUserProfile> {
  const pool = await getPool()

  const existing = await readProfile(pool, userId)
  if (existing) return existing

  await pool.execute(
    `
    INSERT INTO user_profile (user_id, first_name, last_name, phone_number, timezone)
    VALUES (UNHEX(REPLACE(?, '-', '')), '', '', '', '')
    `,
    [userId]
  )

  const created = await readProfile(pool, userId)
  if (!created) {
    throw new Error('failed_to_create_user_profile')
  }
  return created
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileFirstNameById(userId: string, firstName: string): Promise<DbUserProfile> {
    const pool = await getPool()
    await pool.execute(
    `
    UPDATE user_profile SET first_name = ?
    WHERE user_id =  UNHEX(REPLACE(?, '-', ''))
    `,
    [ firstName, userId]
  )
  const p = await readProfile(pool, userId)
  if (!p) throw new Error('profile_not_found_after_update')
  return p
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileLastNameById(userId: string, lastName: string): Promise<DbUserProfile> {
    const pool = await getPool()
    await pool.execute(
    `
    UPDATE user_profile SET last_name = ?
    WHERE user_id =  UNHEX(REPLACE(?, '-', ''))
    `,
    [ lastName, userId]
  )
  const p = await readProfile(pool, userId)
  if (!p) throw new Error('profile_not_found_after_update')
  return p
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfilePhoneNumberById(userId: string, phoneNumber: string): Promise<DbUserProfile> {
    const pool = await getPool()
    await pool.execute(
    `
    UPDATE user_profile SET phone_number = ?
    WHERE user_id =  UNHEX(REPLACE(?, '-', ''))
    `,
    [ phoneNumber, userId]
  )
  const p = await readProfile(pool, userId)
  if (!p) throw new Error('profile_not_found_after_update')
  return p
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileTimezoneById(userId: string, timezone: string): Promise<DbUserProfile> {
    const pool = await getPool()
    await pool.execute(
    `
    UPDATE user_profile SET timezone = ?
    WHERE user_id =  UNHEX(REPLACE(?, '-', ''))
    `,
    [ timezone, userId]
  )
  const p = await readProfile(pool, userId)
  if (!p) throw new Error('profile_not_found_after_update')
  return p
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileById(userId: string, firstName: string,lastName: string,phoneNumber: string,timezone: string): Promise<DbUserProfile> {
  const pool = await getPool()
  await pool.execute(
    `
    UPDATE user_profile SET first_name = ?, last_name = ?, phone_number = ?, timezone = ?
    WHERE user_id =  UNHEX(REPLACE(?, '-', ''))
    `,
    [firstName, lastName, phoneNumber, timezone, userId]
  )
  const p = await readProfile(pool, userId)
  if (!p) throw new Error('profile_not_found_after_update')
  return p
}
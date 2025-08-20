/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/user-profile-repo.ts */
/* ---------------------------------------------------------------------- */

import type { RowDataPacket, PoolConnection } from 'mysql2/promise'
import { query, withConnection, withTransaction, bufToUuid } from '@/server/db/mysql-client'
import { DbUserVisual, DbUserVisualRow } from './user-repo'

/* ---------------------------------------------------------------------- */

export type DbUserProfile = Readonly<{
  user_id: string
  first_name: string
  last_name: string
  phone_number: string
  timezone: string
}>

/* ---------------------------------------------------------------------- */

type DbUserProfileRow = RowDataPacket & {
  user_id: Buffer | Uint8Array | string | null
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  timezone: string | null
}

/* ---------------------------------------------------------------------- */

function rowToUserProfile(row: DbUserProfileRow): DbUserProfile {
  return {
    user_id: bufToUuid(row.user_id),
    first_name: row.first_name ? String(row.first_name) : '',
    last_name: row.last_name ? String(row.last_name) : '',
    phone_number: row.phone_number ? String(row.phone_number) : '',
    timezone: row.timezone ? String(row.timezone) : '',
  }
}

/* ---------------------------------------------------------------------- */

async function readProfile(userId: string, conn?: PoolConnection): Promise<DbUserProfile | null> {
  const sql = `
    SELECT user_id, first_name, last_name, phone_number, timezone
    FROM user_profile
    WHERE user_id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
  `
  if (conn) {
    const [rows] = await conn.execute<DbUserProfileRow[]>(sql, [userId])
    const row = rows[0]
    return row ? rowToUserProfile(row) : null
  }
  const rows = await query<DbUserProfileRow[]>(sql, [userId])
  const row = rows[0]
  return row ? rowToUserProfile(row) : null
}

/* ---------------------------------------------------------------------- */

export async function getUserProfileById(userId: string): Promise<DbUserProfile> {
  return withTransaction(async (conn) => {
    console.log("[USR-PRF-DB] Trying to retrieve data for: "+userId)
    const existing = await readProfile(userId, conn)
    if (existing) 
        return existing
    await conn.execute(
      `
      INSERT INTO user_profile (user_id, first_name, last_name, phone_number, timezone)
      VALUES (UNHEX(REPLACE(?, '-', '')), '', '', '', '')
      `,
      [userId]
    )
    const created = await readProfile(userId, conn)
    if (!created) {
      throw new Error('failed_to_create_user_profile')
    }
    return created
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileFirstNameById(userId: string, firstName: string): Promise<DbUserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET first_name = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [firstName, userId]
    )
    const p = await readProfile(userId, conn)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileLastNameById(userId: string, lastName: string): Promise<DbUserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET last_name = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [lastName, userId]
    )
    const p = await readProfile(userId, conn)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfilePhoneNumberById(userId: string, phoneNumber: string): Promise<DbUserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET phone_number = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [phoneNumber, userId]
    )
    const p = await readProfile(userId, conn)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileTimezoneById(userId: string, timezone: string): Promise<DbUserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile SET timezone = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [timezone, userId]
    )
    const p = await readProfile(userId, conn)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

export async function updateUserProfileById(
  userId: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  timezone: string
): Promise<DbUserProfile> {
  return withConnection(async (conn) => {
    await conn.execute(
      `
      UPDATE user_profile
      SET first_name = ?, last_name = ?, phone_number = ?, timezone = ?
      WHERE user_id = UNHEX(REPLACE(?, '-', ''))
      `,
      [firstName, lastName, phoneNumber, timezone, userId]
    )
    const p = await readProfile(userId, conn)
    if (!p) throw new Error('profile_not_found_after_update')
    return p
  })
}

/* ---------------------------------------------------------------------- */

function parseJsonArray(input: unknown): string[] {
  if (input == null) return []
  try {
    const v = typeof input === 'string' ? JSON.parse(input) : input
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}


function rowToUserLite(row: DbUserVisualRow): DbUserVisual {
  return {
    id: bufToUuid(row.id),
    email: String(row.email),
    is_active: Boolean(row.is_active),
    roles: parseJsonArray(row.roles),
    first_name: row.first_name ? String(row.first_name) : '',
    last_name: row.last_name ? String(row.last_name) : '',
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    permissions: parseJsonArray(row.permissions),

  }
}

export async function listAllUusersVisual(): Promise<DbUserVisual[]> {
  const rows = await query<DbUserVisualRow[]>(
    `
    SELECT
  u.id,
  u.email,
  u.is_active,
  u.roles,
  p.first_name,
  p.last_name
FROM users AS u
LEFT JOIN user_profile AS p
  ON p.user_id = u.id;
    `
  )
  if (!rows || rows.length === 0) return []
  return rows.map(rowToUserLite)
}
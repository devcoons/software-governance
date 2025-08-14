/* user-repo.ts */
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
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/* ---------------------------------------------------------------------- */

function parseJsonArray(input: any): string[] {
  if (input == null) return []
  try {
    const v = typeof input === 'string' ? JSON.parse(input) : input
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}

/* ---------------------------------------------------------------------- */

export type DbUser = Readonly<{
  id: string
  email: string
  username: string
  password: string
  is_active: boolean
  roles: string[]
  permissions: string[]
  totp_enabled: boolean
  force_password_change: boolean
  temp_password_issued_at: string | null
  temp_password_used_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}>

export type DbUserLite = Omit<DbUser, 'password'>

/* ---------------------------------------------------------------------- */

function rowToUser(row: any): DbUser {
  return {
    id: bufToUuid(row.id),
    email: String(row.email),
    username: String(row.username),
    is_active: Boolean(row.is_active),
    roles: parseJsonArray(row.roles),
    permissions: parseJsonArray(row.permissions),
    totp_enabled: Boolean(row.totp_enabled),
    force_password_change: Boolean(row.force_password_change),
    temp_password_issued_at: row.temp_password_issued_at ? String(row.temp_password_issued_at) : null,
    temp_password_used_at: row.temp_password_used_at ? String(row.temp_password_used_at) : null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    password: String(row.password),
  }
}

/* ---------------------------------------------------------------------- */

function rowToUserLite(row: any): DbUserLite {
  return {
    id: bufToUuid(row.id),
    email: String(row.email),
    username: String(row.username),
    is_active: Boolean(row.is_active),
    roles: parseJsonArray(row.roles),
    permissions: parseJsonArray(row.permissions),
    totp_enabled: Boolean(row.totp_enabled),
    force_password_change: Boolean(row.force_password_change),
    temp_password_issued_at: row.temp_password_issued_at ? String(row.temp_password_issued_at) : null,
    temp_password_used_at: row.temp_password_used_at ? String(row.temp_password_used_at) : null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

/* ---------------------------------------------------------------------- */

export async function findUserByLogin(login: string): Promise<DbUser | null> {
  const pool = await getPool()
  const sql = `
    SELECT
      id, email, username, password, is_active,
      roles, permissions, totp_enabled, force_password_change,
      temp_password_issued_at, temp_password_used_at,
      last_login_at, created_at, updated_at
    FROM users
    WHERE email = ? OR username = ?
    LIMIT 1
  `
  const [rows] = await pool.query(sql, [login, login])
  const arr = rows as any[]
  if (!arr || arr.length === 0) return null
  return rowToUser(arr[0])
}

/* ---------------------------------------------------------------------- */

export async function findUserById(id: string): Promise<DbUser | null> {
  const pool = await getPool()
  const sql = `
    SELECT
      id, email, username, password, is_active,
      roles, permissions, totp_enabled, force_password_change,
      temp_password_issued_at, temp_password_used_at,
      last_login_at, created_at, updated_at
    FROM users
    WHERE id =  UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
  `
  const [rows] = await pool.query(sql, [id])
  const arr = rows as any[]
  if (!arr || arr.length === 0) return null
  return rowToUser(arr[0])
}

/* ---------------------------------------------------------------------- */

export async function burnTempPassword(userId: string, unusableHash: string): Promise<void> {
  const pool = await getPool()
  const sql = `
    UPDATE users
    SET password = ?, temp_password_used_at = NOW()
    WHERE id =  UNHEX(REPLACE(?, '-', '')) AND temp_password_issued_at IS NOT NULL AND temp_password_used_at IS NULL
  `
  await pool.execute(sql, [unusableHash, userId])
}

/* ---------------------------------------------------------------------- */

export async function completeForcedPasswordChange(userId: string, newHash: string): Promise<void> {
  const pool = await getPool()
  const sql = `
    UPDATE users
    SET password = ?,
        force_password_change = 0,
        temp_password_issued_at = NULL,
        temp_password_used_at = NULL
    WHERE id =  UNHEX(REPLACE(?, '-', ''))
  `
  await pool.execute(sql, [newHash, userId])
}

/* ---------------------------------------------------------------------- */

export async function upsertTotpSecret(userId: string, secretB32: string): Promise<void> {
  const pool = await getPool()
  await pool.execute(
    `
    INSERT INTO user_totp (user_id, secret_b32, enrolled_at)
    VALUES (UNHEX(REPLACE(?, '-', '')), ?, NOW())
    ON DUPLICATE KEY UPDATE
      secret_b32 = VALUES(secret_b32),
      enrolled_at = VALUES(enrolled_at)
    `,
    [userId, secretB32]
  )
}

/* ---------------------------------------------------------------------- */

export async function enableTotp(userId: string): Promise<void> {
  const pool = await getPool()
  await pool.execute(
    `UPDATE users SET totp_enabled = 1 WHERE id = UNHEX(REPLACE(?, '-', ''))`,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function getTotpInfo(userId: string): Promise<{ enabled: boolean; secret: string | null }> {
  const pool = await getPool()
  const [rows] = await pool.query(
    `
    SELECT u.totp_enabled AS enabled, t.secret_b32 AS secret
    FROM users u
    LEFT JOIN user_totp t ON t.user_id = u.id
    WHERE u.id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
    `,
    [userId]
  )
  const arr = rows as any[]
  if (!arr || arr.length === 0) return { enabled: false, secret: null }
  return {
    enabled: Boolean(arr[0].enabled),
    secret: arr[0].secret ? String(arr[0].secret) : null,
  }
}

/* ---------------------------------------------------------------------- */

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const pool = await getPool()
  await pool.execute(
    `
    UPDATE users
    SET
      password = ?,
      force_password_change = 0,
      temp_password_issued_at = NULL,
      temp_password_used_at = NULL,
      updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [passwordHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function setUserTempPassword(userId: string, passwordHash: string): Promise<void> {
  const pool = await getPool()
  await pool.execute(
    `
    UPDATE users
    SET
      password = ?,
      force_password_change = 1,
      temp_password_issued_at = CURRENT_TIMESTAMP,
      temp_password_used_at = NULL,
      updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [passwordHash, userId]
  )
}
/* ---------------------------------------------------------------------- */

export async function listAllUsers(): Promise<DbUserLite[]> {
  const pool = await getPool()
  const sql = `
    SELECT
      id, email, username, is_active,
      roles, permissions, totp_enabled, force_password_change,
      temp_password_issued_at, temp_password_used_at,
      last_login_at, created_at, updated_at
    FROM users
  `
  const [rows] = await pool.query(sql)
  const arr = rows as any[]
  if(!arr || arr.length === 0)
    return []
  return arr.map(rowToUserLite)
}

/* ---------------------------------------------------------------------- */

export async function deleteUser(userId: string) {
  const pool = await getPool()
  await pool.query(`DELETE FROM users WHERE id = UNHEX(REPLACE(?, '-', ''))`,userId);
}


/* ---------------------------------------------------------------------- */

export async function toggleStatus(userId: string): Promise<boolean | null> {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query(
      `
      SELECT is_active
      FROM users
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      FOR UPDATE
      `,
      [userId]
    )
    const arr = rows as any[]
    if (!arr || arr.length === 0) {
      await conn.rollback()
      return null
    }

    const prev = Boolean(arr[0].is_active)
    const next = prev ? 0 : 1

    const [upd]: any = await conn.execute(
      `
      UPDATE users
      SET is_active = ?, updated_at = NOW()
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      `,
      [next, userId]
    )
    if (!upd?.affectedRows) {
      await conn.rollback()
      return null
    }

    await conn.commit()
    return Boolean(next)
  } catch (e) {
    try { await conn.rollback() } catch {}
    throw e
  } finally {
    conn.release()
  }
}

/* ---------------------------------------------------------------------- */

export async function setUserRole(userId: string, roles: string[]): Promise<void> {
  const pool = await getPool()
  await pool.execute(
     `UPDATE users SET roles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = UNHEX(REPLACE(?, '-', ''))`,
    [JSON.stringify(roles), userId]
   
  )
}
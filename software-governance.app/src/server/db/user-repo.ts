/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/user-repo.ts */
/* ---------------------------------------------------------------------- */

import type { RowDataPacket, PoolConnection, ResultSetHeader } from 'mysql2/promise'
import { query, exec, withTransaction, bufToUuid } from '@/server/db/mysql-client'
import { randomUUID } from 'node:crypto'
import { generatePassword, hashPassword } from '@/libs/password'

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

/* ---------------------------------------------------------------------- */

export type DbUserLite = Omit<DbUser, 'password'>

/* ---------------------------------------------------------------------- */

type DbUserRow = RowDataPacket & {
  id: Buffer | Uint8Array | string | null
  email: string
  username: string
  password: string
  is_active: number
  roles: string | null
  permissions: string | null
  totp_enabled: number
  force_password_change: number
  temp_password_issued_at: Date | string | null
  temp_password_used_at: Date | string | null
  last_login_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

/* ---------------------------------------------------------------------- */

function rowToUser(row: DbUserRow): DbUser {
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

function rowToUserLite(row: DbUserRow): DbUserLite {
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

const USER_SELECT = `
  id, email, username, password, is_active,
  roles, permissions, totp_enabled, force_password_change,
  temp_password_issued_at, temp_password_used_at,
  last_login_at, created_at, updated_at
`

/* ---------------------------------------------------------------------- */

export async function findUserByLogin(login: string): Promise<DbUser | null> {
  const rows = await query<DbUserRow[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE email = ? OR username = ?
    LIMIT 1
    `,
    [login, login]
  )
  const row = rows[0]
  return row ? rowToUser(row) : null
}

/* ---------------------------------------------------------------------- */

export async function findUserById(id: string): Promise<DbUser | null> {
  const rows = await query<DbUserRow[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
    `,
    [id]
  )
  const row = rows[0]
  return row ? rowToUser(row) : null
}

/* ---------------------------------------------------------------------- */

export async function getUserIdByUsername(username: string): Promise<DbUser | null> {
  const rows = await query<DbUserRow[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE username = ?
    LIMIT 1
    `,
    [username]
  )
  const row = rows[0]
  return row ? rowToUser(row) : null
}

/* ---------------------------------------------------------------------- */

export async function burnTempPassword(userId: string, unusableHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET password = ?, temp_password_used_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
      AND temp_password_issued_at IS NOT NULL
      AND temp_password_used_at IS NULL
    `,
    [unusableHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function completeForcedPasswordChange(userId: string, newHash: string): Promise<void> {
  await exec(
    `
    UPDATE users
    SET password = ?,
        force_password_change = 0,
        temp_password_issued_at = NULL,
        temp_password_used_at = NULL,
        updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [newHash, userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function upsertTotpSecret(userId: string, secretB32: string): Promise<void> {
  await exec(
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
  await exec(
    `
    UPDATE users
    SET totp_enabled = 1, updated_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function updateLastLogin(userId: string|undefined): Promise<void> {
    console.log("[USR-DB] Update Last login date for user: "+userId)
    if(!userId) return
  await exec(
    `
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

type TotpInfoRow = RowDataPacket & {
  enabled: number
  secret: string | null
}

/* ---------------------------------------------------------------------- */

export async function getTotpInfo(userId: string): Promise<{ enabled: boolean; secret: string | null }> {
  const rows = await query<TotpInfoRow[]>(
    `
    SELECT u.totp_enabled AS enabled, t.secret_b32 AS secret
    FROM users u
    LEFT JOIN user_totp t ON t.user_id = u.id
    WHERE u.id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
    `,
    [userId]
  )
  const row = rows[0]
  if (!row) return { enabled: false, secret: null }
  return { enabled: Boolean(row.enabled), secret: row.secret ? String(row.secret) : null }
}

/* ---------------------------------------------------------------------- */

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await exec(
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
  await exec(
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
  const rows = await query<DbUserRow[]>(
    `
    SELECT
      id, email, username, is_active,
      roles, permissions, totp_enabled, force_password_change,
      temp_password_issued_at, temp_password_used_at,
      last_login_at, created_at, updated_at
    FROM users
    `
  )
  if (!rows || rows.length === 0) return []
  return rows.map(rowToUserLite)
}

/* ---------------------------------------------------------------------- */

export async function deleteUser(userId: string): Promise<void> {
  await exec(
    `
    DELETE FROM users
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function toggleStatus(userId: string): Promise<boolean | null> {
  return withTransaction<boolean | null>(async (conn: PoolConnection) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `
      SELECT is_active
      FROM users
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      FOR UPDATE
      `,
      [userId]
    )
    const row = rows[0] as RowDataPacket | undefined
    if (!row || typeof row.is_active === 'undefined') return null
    const prev = Boolean(row.is_active)
    const next = prev ? 0 : 1
    const [upd] = await conn.execute<ResultSetHeader>(
      `
      UPDATE users
      SET is_active = ?, updated_at = NOW()
      WHERE id = UNHEX(REPLACE(?, '-', ''))
      `,
      [next, userId]
    )
    if (!upd.affectedRows) return null
    return Boolean(next)
  })
}

/* ---------------------------------------------------------------------- */

export async function setUserRole(userId: string, roles: string[]): Promise<void> {
  await exec(
    `
    UPDATE users
    SET roles = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [JSON.stringify(roles), userId]
  )
}

/* ---------------------------------------------------------------------- */

export async function createUserWithTempPassword(
  email: string,
  roles: string[] = ['user'],
): Promise<{ id: string; tempPassword: string }> {
    const id = randomUUID()
    const normalizedEmail = email.trim().toLowerCase()
    const username = normalizedEmail // deterministic, satisfies UNIQUE(username)
    const tempPassword = generatePassword(14)
    const passwordHash = await hashPassword(tempPassword)

    try {
        await withTransaction(async (conn) => {
        await conn.execute(
            `
            INSERT INTO users (
            id, email, username, password,
            is_active, roles, permissions,
            totp_enabled, force_password_change,
            temp_password_issued_at, temp_password_used_at,
            created_at, updated_at
            )
            VALUES (
            UNHEX(REPLACE(?, '-', '')), ?, ?, ?,
            1, ?, '[]',
            0, 1,
            NOW(), NULL,
            NOW(), NOW()
            )
            `,
            [id, normalizedEmail, username, passwordHash, JSON.stringify(roles)],
        )

        await conn.execute(
            `
            INSERT INTO user_profile (user_id, first_name, last_name, phone_number, timezone)
            VALUES (UNHEX(REPLACE(?, '-', '')), NULL, NULL, NULL, NULL)
            `,
            [id],
        )
        })
    } catch (err: unknown) {
        const code = getErrorCode(err)
        if (code === 'ER_DUP_ENTRY') {
            throw Object.assign(new Error('duplicate_user'), { code: 'duplicate_user', cause: err })
        }
        throw err
    }

    return { id, tempPassword }
}


function getErrorCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined
  if (!('code' in e)) return undefined
  const c = (e as { code?: unknown }).code
  return typeof c === 'string' ? c : undefined
}
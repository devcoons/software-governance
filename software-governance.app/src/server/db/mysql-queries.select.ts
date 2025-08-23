/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql-queries.select.ts */
/* ---------------------------------------------------------------------- */

import { keyRule, normalizeRowsWithKeys, normalizeRowWithKeys } from "@devcoons/row-normalizer";
import { query } from "./mysql-client";
import { DbUser, DbUserProfile, DbUserVisual, User, UserLite, UserProfile, UserVisual } from "./mysql-types";
import { rules } from "./mysql-utils";
import { RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";

/* ---------------------------------------------------------------------- */

const USER_TABLE_ALL = `
  id, email, username, is_active,
  roles, permissions, totp_enabled, force_password_change,
  temp_password_issued_at, temp_password_used_at,
  last_login_at, created_at, updated_at
`

const USER_SELECT = `
  id, email, username, password, is_active,
  roles, permissions, totp_enabled, force_password_change,
  temp_password_issued_at, temp_password_used_at,
  last_login_at, created_at, updated_at
`

/* ---------------------------------------------------------------------- */

export async function listAllUsersVisual(): Promise<UserVisual[]> {
  const rows = await query<DbUserVisual[]>(
    `   SELECT u.id, u.email, u.is_active, u.roles, u.last_login_at, p.first_name, p.last_name
        FROM users AS u LEFT JOIN user_profile AS p ON p.user_id = u.id; `
  )
  return rows ? normalizeRowsWithKeys(rows as unknown as DbUserVisual[], rules) : []
}

/* ---------------------------------------------------------------------- */

export async function listAllUsers(): Promise<UserLite[]> {
  const rows = await query<DbUser[]>(
    `
    SELECT
      id, email, username, is_active,
      roles, permissions, totp_enabled, force_password_change,
      temp_password_issued_at, temp_password_used_at,
      last_login_at, created_at, updated_at
    FROM users
    `
  )
  return (!rows || rows.length === 0) ? [] 
            : normalizeRowsWithKeys(rows as unknown as UserLite[], rules)
}

/* ---------------------------------------------------------------------- */

export async function findUserByLogin(login: string): Promise<User | null> {
  const rows = await query<DbUser[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE email = ? OR username = ?
    LIMIT 1
    `,
    [login, login]
  )
  return rows[0] ? normalizeRowWithKeys(rows[0] as unknown as User, rules) : null
}

/* ---------------------------------------------------------------------- */

export async function findUserByCredetials(username: string, password: string): Promise<User | null> {
  const rows = await query<DbUser[]>(
    `
    SELECT ${USER_TABLE_ALL}
    FROM users
    WHERE username = ? AND password = ?
    LIMIT 1
    `,
    [username, password]
  )
  return rows[0] ? normalizeRowWithKeys(rows[0] as unknown as User, rules) : null
}

/* ---------------------------------------------------------------------- */

export async function findUserById(id: string): Promise<User | null> {
  const rows = await query<DbUser[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
    `,
    [id]
  )
  return rows[0] ? normalizeRowWithKeys(rows[0] as unknown as User, rules) : null
}

/* ---------------------------------------------------------------------- */

export async function getUserIdByUsername(username: string): Promise<User | null> {
  const rows = await query<DbUser[]>(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE username = ?
    LIMIT 1
    `,
    [username]
  )
  return rows[0] ? normalizeRowWithKeys(rows[0] as unknown as User, rules) : null
}

/* ---------------------------------------------------------------------- */

export async function getTotpInfo(userId: string): Promise<{ enabled: boolean; secret: string | null }> {
  const rows = await query<RowDataPacket & {enabled: number, secret: string | null}[]>(
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

export async function readUserProfile(userId: string): Promise<UserProfile | null> {
  const sql = `
    SELECT user_id, first_name, last_name, phone_number, timezone
    FROM user_profile
    WHERE user_id = UNHEX(REPLACE(?, '-', ''))
    LIMIT 1
  `
  const rows = await query<DbUserProfile[]>(sql, [userId])
  return rows ? normalizeRowWithKeys(rows[0] as unknown as UserProfile, rules) : null
}
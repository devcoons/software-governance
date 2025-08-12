import { query, exec } from '../db/core';
import { binToUuid, uuidToBin, newUuidBin } from '../uuid';

export type UserRow = {
  id: Buffer;              // BINARY(16)
  email: string;
  password: string;        // argon2id hash
  roles: string | null;    // JSON text
  permissions: string | null;
  totp_enabled: number;
  force_password_change: number;
  created_at: Date;
  updated_at: Date;
};

export type User = {
  id: string;
  email: string;
  password: string;
  roles: string[];
  permissions: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
};

export type UserListItem = {
  id: string;
  email: string;
  roles: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
};

function mapRow(r: UserRow): User {
  return {
    id: binToUuid(r.id),
    email: r.email,
    password: r.password,
    roles: r.roles ? JSON.parse(r.roles) : [],
    permissions: r.permissions ? JSON.parse(r.permissions) : [],
    totpEnabled: !!r.totp_enabled,
    forcePasswordChange: !!r.force_password_change,
  };
}

export async function listAllUsers(): Promise<UserListItem[]> {
  const rows = await query<any[]>(
    `SELECT id,email,roles,totp_enabled,force_password_change,created_at
       FROM users ORDER BY created_at DESC`
  );
  return rows.map(r => ({
    id: binToUuid(r.id),
    email: r.email,
    roles: r.roles ? JSON.parse(r.roles) : [],
    totpEnabled: !!r.totp_enabled,
    forcePasswordChange: !!r.force_password_change,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function updateRoles(userId: string, roles: string[]) {
  await exec(
    `UPDATE users SET roles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(roles), uuidToBin(userId)]
  );
}

/**
 * Convenience: set a single primary role (we store roles as an array).
 */
export async function setRole(userId: string, role: 'admin' | 'user' | 'viewer') {
  await updateRoles(userId, [role]);
}

export async function getByEmail(email: string): Promise<User | null> {
  const rows = await query<UserRow[]>(
    `SELECT id,email,password,roles,permissions,totp_enabled,force_password_change,created_at,updated_at
       FROM users
      WHERE email = ? LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getById(id: string): Promise<User | null> {
  const rows = await query<UserRow[]>(
    `SELECT id,email,password,roles,permissions,totp_enabled,force_password_change,created_at,updated_at
       FROM users
      WHERE id = ? LIMIT 1`,
    [uuidToBin(id)],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export type UserComplete = {
  id: string;
  email: string;
  password: string;
  roles: string[];
  permissions: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
  updateAt: string;
};

function mapUserRow(r: UserRow): UserComplete {
  return {
    id                  : binToUuid(r.id),
    email               : r.email,
    password            : r.password,
    roles               : r.roles ? JSON.parse(r.roles) : [],
    permissions         : r.permissions ? JSON.parse(r.permissions) : [],
    totpEnabled         : !!r.totp_enabled,
    forcePasswordChange : !!r.force_password_change,
    createdAt           : r.created_at.toISOString(),
    updateAt            : r.updated_at.toISOString()
  };
}

export async function getUserById(id: string): Promise<UserComplete | null> {
  const rows = await query<UserRow[]>(
      `SELECT id,email,password,roles,permissions,totp_enabled,force_password_change,created_at,updated_at FROM users WHERE id = ? LIMIT 1`, 
      [uuidToBin(id)]);
  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function create(
  email: string,
  passwordHash: string,
  roles: string[] = [],
  permissions: string[] = [],
) {
  const { idStr, idBin } = newUuidBin();
  await exec(
    `INSERT INTO users (id,email,password,roles,permissions,totp_enabled,force_password_change)
     VALUES (?,?,?,?,?,0,1)`,
    [idBin, email.toLowerCase().trim(), passwordHash, JSON.stringify(roles), JSON.stringify(permissions)],
  );
  return idStr;
}

/**
 * Set password and optionally mark that the user must change it on next login.
 * Force-change is handy when admins set a temp password.
 */
export async function setPassword(
  userId: string,
  passwordHash: string,
  { forceChange = false }: { forceChange?: boolean } = {},
) {
  await exec(
    `UPDATE users
        SET password = ?, force_password_change = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [passwordHash, forceChange ? 1 : 0, uuidToBin(userId)],
  );
}

export async function setForcePasswordChange(userId: string, val: boolean) {
  await exec(
    `UPDATE users
        SET force_password_change = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [val ? 1 : 0, uuidToBin(userId)],
  );
}

export async function setTOTPEnabled(userId: string, enabled: boolean) {
  await exec(
    `UPDATE users
        SET totp_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [enabled ? 1 : 0, uuidToBin(userId)],
  );
}

/** Used by the forced-password flow to both set the hash and clear the flag. */
export async function updatePasswordAndClearForce(userId: string, newHash: string) {
  const res = await query(
    `UPDATE users
        SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [newHash, uuidToBin(userId)],
  );
  return (res as any).affectedRows as number;
}

/**
 * Delete a user account by id.
 * NOTE: if your DB has FKs (sessions, totp secrets, etc.), handle cascading in SQL or here.
 */
export async function deleteUser(userId: string) {
  await exec(`DELETE FROM users WHERE id = ?`, [uuidToBin(userId)]);
}

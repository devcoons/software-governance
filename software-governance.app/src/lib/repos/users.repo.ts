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

export async function create(
  email: string,
  passwordHash: string,
  roles: string[] = [],
  permissions: string[] = [],
) {
  const { idStr, idBin } = newUuidBin();
  await exec(
    `INSERT INTO users (id,email,password,roles,permissions,totp_enabled,force_password_change)
     VALUES (?,?,?,?,?,0,0)`,
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
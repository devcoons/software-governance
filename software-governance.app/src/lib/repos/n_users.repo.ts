import { query, exec } from '../db/core';
import { binToUuid, uuidToBin, newUuidBin } from '../uuid';


/*
/   DB User Fields
*/
export type UserRow = {
  id                    : Buffer;          
  email                 : string;
  password              : string;        
  roles                 : string | null;  
  permissions           : string | null;
  totp_enabled          : number;
  force_password_change : number;
  created_at            : Date;
  updated_at            : Date;
};

export type User = {
  id                    : string;
  email                 : string;
  password              : string;
  roles                 : string[];
  permissions           : string[];
  totpEnabled           : boolean;
  forcePasswordChange   : boolean;
  createdAt             : string;
  updateAt              : string;
};

function mapUserRow(r: UserRow): User {
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

export async function getUserById(id: string): Promise<User | null> {
  const rows = await query<UserRow[]>(
      `SELECT id,email,password,roles,permissions,totp_enabled,force_password_change,created_at,updated_at FROM users WHERE id = ? LIMIT 1`, 
      [uuidToBin(id)]);
  return rows[0] ? mapUserRow(rows[0]) : null;
}
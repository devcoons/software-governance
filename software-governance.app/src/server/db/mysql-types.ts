/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql.types.ts */
/* ---------------------------------------------------------------------- */

import { RowDataPacket } from "mysql2/promise";

/* ---------------------------------------------------------------------- */

export type UserVisual = {
    id: string
    email: string
    first_name: string 
    last_name: string
    is_active: boolean
    roles: string[]
    permissions: string[]
    last_login_at: string | null
}

export type DbUserVisual =  RowDataPacket & Readonly<{
    id: Buffer | Uint8Array | string | null
    email: string
    first_name: string | null
    last_name: string | null
    is_active: number
    roles: string[]
    permissions: string[]
    last_login_at: Date | string
}>

/* ---------------------------------------------------------------------- */

export type User = {
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
}

export type UserLite = Omit<User, 'password'>

export type DbUser =  RowDataPacket & Readonly<{
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
}>

/* ---------------------------------------------------------------------- */

export type UserProfile = {
    user_id: string
    first_name: string
    last_name: string
    phone_number: string
    timezone: string
}

export type DbUserProfile =  RowDataPacket & Readonly<{
    user_id: Buffer | Uint8Array | string | null
    first_name: string | null
    last_name: string | null
    phone_number: string | null
    timezone: string | null
}>

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
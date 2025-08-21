/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql.types.ts */
/* ---------------------------------------------------------------------- */

import { keyRule } from "@devcoons/row-normalizer";
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

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
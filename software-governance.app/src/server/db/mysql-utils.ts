/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql.utils.ts */
/* ---------------------------------------------------------------------- */

import { keyRule } from "@devcoons/row-normalizer";

/* ---------------------------------------------------------------------- */

export const rules = [
    keyRule('user_id', (v) => bufToUuid(v as any)),
    keyRule('id', (v) => bufToUuid(v as any)),
    keyRule('username', (v) => v ? String(v) : ''),
    keyRule('first_name', (v) => v ? String(v) : ''),
    keyRule('last_name', (v) => v ? String(v) : ''),
    keyRule('phone_number', (v) => v ? String(v) : ''),
    keyRule('timezone', (v) => v ? String(v) : ''),
    keyRule('email', (v) => v ? String(v) : ''),
    keyRule('password', (v) => v ? String(v) : ''),
    keyRule('created_at', (v) => v ? String(v) : ''),
    keyRule('updated_at', (v) => v ? String(v) : ''),
    keyRule('temp_password_issued_at', (v) => v ? String(v) : ''),
    keyRule('temp_password_used_at', (v) => v ? String(v) : ''),
    keyRule('last_login_at', (v) => v ? String(v) : ''),
    keyRule('is_active', (v) => v ? Boolean(v) : false),
    keyRule('totp_enabled', (v) => v ? Boolean(v) : false),
    keyRule('force_password_change', (v) => v ? Boolean(v) : false),
    keyRule('roles', (v) => v ? parseJsonArray(v) : []),
    keyRule('permissions', (v) => v ? parseJsonArray(v) : []),
] 

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

function bufToUuid(b: unknown): string {
    if (!b) return ''
    if (typeof b === 'string') return b

    let buf: Buffer
    if (Buffer.isBuffer(b)) {
        buf = b
    } else if (ArrayBuffer.isView(b)) {
        const v = b as ArrayBufferView
        buf = Buffer.from(v.buffer as ArrayBuffer, v.byteOffset, v.byteLength)
    } else if (b instanceof ArrayBuffer) {
        buf = Buffer.from(new Uint8Array(b))
    } else {
        return ''
    }

    const hex = buf.toString('hex')
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join('-')
}

/* ---------------------------------------------------------------------- */

export function getErrorCode(e: unknown): string | undefined {
    if (typeof e !== 'object' || e === null) return undefined
    if (!('code' in e)) return undefined
    const c = (e as { code?: unknown }).code
    return typeof c === 'string' ? c : undefined
}

/* ---------------------------------------------------------------------- */
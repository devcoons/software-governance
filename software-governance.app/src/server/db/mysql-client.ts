/* src/server/db/mysql-client.ts */

import 'server-only'
import config from '@/config'
import mysql, {
    type Pool,
    type PoolConnection,
    type RowDataPacket,
    type ResultSetHeader,
} from 'mysql2/promise'

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

const g = globalThis as { __MYSQL_POOL__?: Pool }
let pool: Pool | null = g.__MYSQL_POOL__ ?? null

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

function getPool(): Pool {
    if (pool) 
        return pool
    pool = mysql.createPool({
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
    g.__MYSQL_POOL__ = pool
    return pool
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

export async function query<T = RowDataPacket[]>(
  sql: string,
  params?: ReadonlyArray<unknown>
): Promise<T> {
  const [rows] = await getPool().execute(sql, params)
  return rows as T
}

/* ---------------------------------------------------------------------- */

export async function exec(
  sql: string,
  params?: ReadonlyArray<unknown>
): Promise<ResultSetHeader> {
  const [res] = await getPool().execute<ResultSetHeader>(sql, params)
  return res
}

/* ---------------------------------------------------------------------- */

export async function withConnection<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    return await fn(conn)
  } finally {
    conn.release()
  }
}

/* ---------------------------------------------------------------------- */

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    try { await conn.rollback() } catch {}
    throw e
  } finally {
    conn.release()
  }
}

/* ---------------------------------------------------------------------- */

export async function pingDb(): Promise<{ ok: boolean; details?: string }> {
  const p = getPool()
  const t0 = Date.now()
  try {
    const conn = await p.getConnection()
    try { await conn.query('SELECT 1') } finally { conn.release() }
    return { ok: true, details: `ping ${Date.now() - t0}ms` }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : e 
    return { ok: false, details: String(msg) }
  }
}

/* ---------------------------------------------------------------------- */

export function bufToUuid(b: unknown): string {
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


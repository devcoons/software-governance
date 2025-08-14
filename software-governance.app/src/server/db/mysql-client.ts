/* mysql-client.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import config from '@/config'
import mysql from 'mysql2/promise'

/* ---------------------------------------------------------------------- */

type Pool = mysql.Pool

/* ---------------------------------------------------------------------- */

const g = globalThis as any

/* ---------------------------------------------------------------------- */

let pool: Pool | null = g.__MYSQL_POOL__ || null

/* ---------------------------------------------------------------------- */

function getPool(): Pool {
  if (pool) return pool
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

export async function pingDb(): Promise<{ ok: boolean; details?: string }> {
  const p = getPool()
  const t0 = Date.now()
  try {
    const conn = await p.getConnection()
    try {
      await conn.query('SELECT 1')
    } finally {
      conn.release()
    }
    const ms = Date.now() - t0
    return { ok: true, details: `ping ${ms}ms` }
  } catch (e: any) {
    return { ok: false, details: String(e?.message || e) }
  }
}


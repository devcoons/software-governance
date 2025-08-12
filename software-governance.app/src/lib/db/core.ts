// src/lib/db/core.ts
import mysql, { Pool } from 'mysql2/promise';
import {
  DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME,
} from '@/auth.config';

// --- Singleton pool across hot reloads ---
declare global {
  // eslint-disable-next-line no-var
  var __sgov_mysql_pool__: Pool | undefined;
}

function createPool(): Pool {
  return mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    // keep this reasonable; avoid huge fan-out in dev
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export const pool: Pool =
  global.__sgov_mysql_pool__ ?? (global.__sgov_mysql_pool__ = createPool());

// --- Thin helpers ---
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export async function exec(sql: string, params?: any[]) {
  const [res] = await pool.execute(sql, params);
  return res;
}

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

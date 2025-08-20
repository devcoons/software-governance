/* seed-admin.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import mysql from 'mysql2/promise'
import config from '../src/config'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/libs/password'

/* ---------------------------------------------------------------------- */

type Conn = mysql.Pool

/* ---------------------------------------------------------------------- */

function uuidBytes(): Buffer {
  const hex = randomUUID().replace(/-/g, '')
  return Buffer.from(hex, 'hex')
}

/* ---------------------------------------------------------------------- */

function bufToUuid(b: Buffer): string {
  const hex = b.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/* ---------------------------------------------------------------------- */

async function connect(): Promise<Conn> {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    enableKeepAlive: true,
    connectTimeout: 5000,
  })
  return pool
}

/* ---------------------------------------------------------------------- */

async function emailExists(db: Conn, email: string): Promise<boolean> {
  const [rows] = await db.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email])
  const arr = rows as any[]
  return !!(arr && arr.length > 0)
}

/* ---------------------------------------------------------------------- */

async function insertUser(db: Conn, args: {
  id: Buffer
  email: string
  passwordHash: string
  roles: string[]
  permissions: string[]
}): Promise<void> {
  await db.execute(
    `
    INSERT INTO users (
      id, email, username, password, is_active,
      roles, permissions, totp_enabled, force_password_change
    ) VALUES (?, ?, ?, ?, 1, ?, ?, 0, 0)
    `,
    [
      args.id,
      args.email,
      args.email,
      args.passwordHash,
      JSON.stringify(args.roles),
      JSON.stringify(args.permissions),
    ]
  )
}

/* ---------------------------------------------------------------------- */

async function insertAudit(db: Conn, userId: Buffer, type: string, meta: any): Promise<void> {
  await db.execute(
    `INSERT INTO audit_log (user_id, type, meta) VALUES (?, ?, ?)`,
    [userId, type, JSON.stringify(meta ?? {})]
  )
}

/* ---------------------------------------------------------------------- */

async function main() {
  const rawEmail = String(process.argv[2] || '').trim().toLowerCase()
  const plain = String(process.argv[3] || '')

  if (!rawEmail || !plain) {
    console.error('Usage: npx tsx scripts/seed-admin.ts <email> <password>')
    process.exit(1)
  }

  console.log('[seed-admin] Connecting')
  console.log(`  Host: ${config.DB_HOST}`)
  console.log(`  Port: ${config.DB_PORT}`)
  console.log(`  User: ${config.DB_USER}`)
  console.log(`  Pass: ${config.DB_PASSWORD ? '***' : '(empty)'}`)
  console.log(`  DB:   ${config.DB_NAME}`)

  if (!config.DB_PASSWORD) {
    console.error('[seed-admin] ERROR: DB_PASSWORD is empty')
    process.exit(1)
  }

  const db = await connect()

  try {
    if (await emailExists(db, rawEmail)) {
      console.error(`[seed-admin] Email already exists: ${rawEmail}`)
      process.exit(2)
    }

    const passwordHash = await hashPassword(plain)
    const id = uuidBytes()

    await insertUser(db, {
      id,
      email: rawEmail,
      passwordHash,
      roles: ['admin'],
      permissions: ['*'],
    })

    await insertAudit(db, id, 'seed_admin', { email: rawEmail })

    console.log(`[seed-admin] Seeded admin ${rawEmail}`)
    console.log(`  id: ${bufToUuid(id)}`)
    console.log(`  username: ${rawEmail}`)
  } finally {
    await db.end()
  }
}

/* ---------------------------------------------------------------------- */

main().catch((e) => {
  console.error('[seed-admin] ERROR:', e)
  process.exit(1)
})

// scripts/seed_admin.ts
import '../src/env'; // load ../.env.local or ../.env
import { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } from '../src/auth.config';
import * as Users from '../src/lib/repos/users.repo';
import { audit } from '../src/lib/repos/audit.repo';
import { hash } from '@node-rs/argon2';

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2, // argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
    saltLength: 16,
  });
}

async function main() {
  const rawEmail = process.argv[2] || '';
  const plain = process.argv[3];

  const email = rawEmail.trim().toLowerCase();

  if (!email || !plain) {
    console.error('Usage: npx tsx scripts/seed_admin.ts <email> <password>');
    process.exit(1);
  }

  // Guardrail: show connection target with masked password
  console.log('[seed_admin] Connecting to DB with:');
  console.log(`  Host: ${DB_HOST}`);
  console.log(`  Port: ${DB_PORT}`);
  console.log(`  User: ${DB_USER}`);
  console.log(`  Pass: ${DB_PASS ? '***' : '(empty)'}`);
  console.log(`  DB:   ${DB_NAME}`);

  if (!DB_PASS) {
    console.error('[seed_admin] ERROR: DB_PASS is empty (check DB_PASSWORD_FILE path or env).');
    process.exit(1);
  }

  // Duplicate email check
  const existing = await Users.getByEmail(email);
  if (existing) {
    console.error(`[seed_admin] Email already exists: ${email}`);
    process.exit(2);
  }

  // Hash password and create user with admin role
  const pwHash = await hashPassword(plain);
  const id = await Users.create(email, pwHash, ['admin'], ['*']);

  await audit('seed_admin', { email });

  console.log(`[seed_admin] Seeded admin ${email} with id ${id}`);
}

main().catch((e) => {
  console.error('[seed_admin] ERROR:', e);
  process.exit(1);
});

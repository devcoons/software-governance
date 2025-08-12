// src/env.ts
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const candidates = [
  path.resolve(process.cwd(), '../.env.local'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    // expose the directory of the env file so other code can resolve relative paths
    process.env.__ENV_DIR__ = path.dirname(p);
    break;
  }
}

// fallback: if nothing matched, set __ENV_DIR__ to CWD
if (!process.env.__ENV_DIR__) {
  process.env.__ENV_DIR__ = process.cwd();
}

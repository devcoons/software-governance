/* scripts/print-config.ts */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import config from '../src/config'

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

function buildStructuredSnapshot(cfg: any) {
  return {
    app: cfg.app,
    db: cfg.db,
    redis: cfg.redis,
    session: cfg.session,
    cookies: {
      secure: cfg.cookies.secure,
      sameSite: cfg.cookies.sameSite,
      path: cfg.cookies.path,
    },
    security: {
      argon2: cfg.security.argon2,
      rateLimit: cfg.security.rateLimit,
      totpIssuer: cfg.security.totpIssuer,
    },
    health: cfg.health,
    public: cfg.public,
  }
}

/* ---------------------------------------------------------------------- */

function printSection(title: string, obj: unknown) {
  process.stdout.write(`\n=== ${title} ===\n`)
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`)
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

const structured = buildStructuredSnapshot(config as any)
printSection('Global CONFIGURATION', structured)

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

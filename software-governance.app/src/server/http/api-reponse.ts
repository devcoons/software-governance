// src/server/http/api-response.ts
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server'

/* ---------------------------------------------------------------------- */

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  const opts = typeof init === 'number' ? { status: init } : init
  return NextResponse.json({ ok: true, ...data }, opts)
}

/* ---------------------------------------------------------------------- */

export function jsonErr(error: string, init?: number | ResponseInit) {
  const opts = typeof init === 'number' ? { status: init } : init
  return NextResponse.json({ ok: false, error }, opts)
}

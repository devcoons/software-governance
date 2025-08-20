/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/totp/base32.ts */
/* ---------------------------------------------------------------------- */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAP: Record<string, number> = Object.fromEntries(
    [...ALPHABET].map((ch, i) => [ch, i]),
);

/* ---------------------------------------------------------------------- */

function decodeToBuffer(secret: string): Buffer {
  const clean = secret.replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of clean) {
    const v = MAP[ch];
    if (v === undefined) continue;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/* ---------------------------------------------------------------------- */

function encodeFromBuffer(bytes: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';

    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
        bits -= 5;
        out += ALPHABET[(value >>> bits) & 31];
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

/* ---------------------------------------------------------------------- */

export function keyDecoder(secret: string): string {
    return decodeToBuffer(secret).toString('ascii');
}

/* ---------------------------------------------------------------------- */

export function keyEncoder(ascii: string): string {
    const buf = Buffer.from(ascii, 'ascii');
    return encodeFromBuffer(buf);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

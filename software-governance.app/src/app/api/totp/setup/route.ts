import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/cookies';
import { sessionStore } from '@/lib/sstore.node';
import { getById, insertAudit } from '@/lib/repos/users.repo';
import { getTotpByUser, upsertTotpSecret } from '@/lib/repos/totp.repo';
import { TOTP_ISSUER } from '@/auth.config';
import { authenticator } from '@/lib/totp'; // ✅ uses shared config
import QRCode from 'qrcode';
import { rateLimit } from '@/lib/rate';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sess = await sessionStore.getSession(sid);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sub: userId, email } = sess.claims;

  // rate limit: 10 requests / 10 minutes
  const rl = await rateLimit(`totp:setup:${userId}`, 10, 600);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests, try later.' }, { status: 429 });

  const user = await getById(userId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) Get existing secret or create a new one
  let secret = (await getTotpByUser(userId))?.secret_b32;
  let created = false;

  if (!secret) {
    secret = authenticator.generateSecret(); // ✅ already lowercase algo via shared config
    await upsertTotpSecret(userId, secret);
    await insertAudit(userId, 'totp_secret_created', null);
    created = true;
  }

  // 2) Build otpauth URI & QR code
  const accountName = user.email || email;
  const otpauth = authenticator.keyuri(accountName, TOTP_ISSUER, secret);
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 256 });

  // 3) Always return QR code
  return NextResponse.json({
    qr,
    otpauth,
    totpEnabled: !!user.totpEnabled,
    created,
  });
}

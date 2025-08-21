// src/server/totp/provider.ts
import { authenticator } from 'otplib'
import { findUserById, getTotpInfo } from '../db/mysql-queries.select';
import { upsertTotpSecret } from '../db/mysql-queries.insert';
import { enableTotp } from '../db/mysql-queries.update';

export function buildKeyUri(input: { account: string; issuer: string; secret: string }) {
    return authenticator.keyuri(input.account, input.issuer, input.secret)
}

function checkCode(secret: string, token: string): boolean {
    authenticator.options = { window: 1 }
    return authenticator.check(token, secret)
}


export async function getOrCreateTotpUri(userId: string, issuer: string) {
    const user = await findUserById(userId)
    const account = user?.email ?? user?.username ?? userId

    const info = await getTotpInfo(userId)
    if (info?.secret) {
        return {
        ok: true as const,
        enabled: !!info.enabled,
        account,
        issuer,
        otpauthUrl: buildKeyUri({ account, issuer, secret: info.secret }),
        }
    }

    const secret = authenticator.generateSecret()
    await upsertTotpSecret(userId, secret)
    return {
        ok: true as const,
        enabled: false,
        account,
        issuer,
        otpauthUrl: buildKeyUri({ account, issuer, secret }),
    }
}

export async function verifyTotpPin(userId: string, pin: string) {
   // return { ok: true as const }
    const info = await getTotpInfo(userId)
    if (!info?.secret) return { ok: false as const, error: 'no_secret' as const }
    if (!checkCode(info.secret, String(pin ?? '').trim())) {
        return { ok: false as const, error: 'invalid_code' as const }
    }
    await enableTotp(userId)
    return { ok: true as const }
}

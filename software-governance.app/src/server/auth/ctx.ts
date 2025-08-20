/* ---------------------------------------------------------------------- */
/* Filepath: /src/auth/ctx.ts */
/* ---------------------------------------------------------------------- */

import app from '@/config' 
import { NextRequest } from "next/server";
import { claimsFromDbUser, LoginInput, LoginResult } from "@/types/provider";
import { cookies, headers } from 'next/headers'
import { redisStore } from './redis';
import { verifyPassword, hashPassword } from '@/libs/password';
import { findUserByLogin, burnTempPassword, updateLastLogin, findUserById } from '../db/user-repo';
import { getIpHint, getUaHash } from './ua-ip';
import { randomId } from '@/libs/random-id';
import { GetAndRefreshSessionResult, LogoutMode, LogoutResult, RefreshRecord, SessionClaims, SessionRecord } from './types';
import { redirect } from 'next/navigation';
import { getBoolClaim } from '@/app/_com/utils';

/* ---------------------------------------------------------------------- */

function newSession(userId: string, claims: SessionClaims, parent_rid?: string): SessionRecord {
    const now = Date.now()
    const iat = now
    const exp = now + Number(app.SESSION_TTL_SECONDS) * 1000
    return {
        sid: randomId(32),
        user_id: userId,
        claims,
        iat,
        exp,
        parent_rid
    }
}

/* ---------------------------------------------------------------------- */

function newRefresh(input: {userId: string,  rememberMe: boolean, uaHash: string, ipHint: string }): RefreshRecord {
    const now = Date.now()
    const absMs = Number(app.REFRESH_ABSOLUTE_TTL_SECONDS) * 1000
    return {
        rid: randomId(32),
        user_id: input.userId,
        remember_me: input.rememberMe,
        ua_hash: input.uaHash,
        ip_hint: input.ipHint,
        created_at: now,
        last_used_at: now,
        absolute_exp_at: now + absMs,
    }
}

/* ---------------------------------------------------------------------- */

export async function getCurrentSession(req?: NextRequest) :  Promise<SessionRecord | null> {

    const sidCookieVal = req
                        ? req.cookies.get(app.SESSION_COOKIE)?.value || null
                        : (await cookies()).get(app.SESSION_COOKIE)?.value || null

    console.log('[AUTH-CTX-getCurrentSession()] - ', 'sid:', sidCookieVal ? '1' : '0','(',sidCookieVal,")")
  
    if (sidCookieVal){
        const result = await redisStore.getSession(sidCookieVal);
        if(!result)
        {
            console.log('[AUTH-CTX-getCurrentSession()] - ', 'SID expired')
            return null            
        }
        console.log('[AUTH-CTX-getCurrentSession()] - ', 'current session details:', result)
        return result        
    }

    console.log('[AUTH-CTX-getCurrentSession()] - ', 'No SID provided - returning null')
    return null
}

/* ---------------------------------------------------------------------- */

export async function getCurrentRefresh(req?: NextRequest) :  Promise<RefreshRecord | null> {

    const ridCookieVal = req
                        ? req.cookies.get(app.REFRESH_COOKIE)?.value || null
                        : (await cookies()).get(app.REFRESH_COOKIE)?.value || null

    console.log('[AUTH-CTX-getCurrentRefresh()] - ', 'rid:', ridCookieVal ? '1' : '0','(',ridCookieVal,')')
  
    if (ridCookieVal){
        const result = await redisStore.getRefresh(ridCookieVal);
        console.log('[AUTH-CTX-getCurrentRefresh()] - ', 'current refresh details:', result)
        return result        
    }

    console.log('[AUTH-CTX-getCurrentRefresh()] - ', 'No RID provided - returning null')
    return null
}

/* ---------------------------------------------------------------------- */

export async function getAndRefreshCurrentSession(req: NextRequest) : Promise<GetAndRefreshSessionResult | null>{

    const currentSession = await getCurrentSession(req)
    if (currentSession) {
        console.log('[AUTH-CTX-getAndRefreshCurrentSession()] - ', 'Session hit via SID')
        return { ok : true, sid: currentSession.sid, rid: currentSession.parent_rid ?? '' }
    }
    console.log('[AUTH-CTX-getAndRefreshCurrentSession()] - ', 'SID verification failed. Trying to refresh session')
    const currentRefresh = await getCurrentRefresh(req)
    if (!currentRefresh) {
        console.log('[AUTH-CTX-getAndRefreshCurrentSession()] - ', 'No RID -> unauthorized')
        return { ok : false, error: "unauthorized:norid" }
    }

    const now = Date.now()
    const absMs = Number(app.REFRESH_ABSOLUTE_TTL_SECONDS) * 1000
    const idleMs = Number(app.REFRESH_IDLE_TTL_SECONDS) * 1000

    if (currentRefresh.created_at + absMs <= now) return { ok: false, error: 'refresh_expired_absolute' }
    if (currentRefresh.last_used_at + idleMs <= now) return { ok: false, error: 'refresh_expired_idle' }

    const uaHash = app.BIND_UA ? getUaHash(req) : ''
    const ipHint = getIpHint(req)

    if (app.BIND_UA && uaHash !== currentRefresh.ua_hash) return { ok: false, error: 'ua_mismatch' }
    if (app.BIND_IP && ipHint && currentRefresh.ip_hint && ipHint !== currentRefresh.ip_hint) return { ok: false, error: 'ip_mismatch' }

    const user = await findUserById(currentRefresh.user_id)
    if (!user || !user.is_active) return { ok: false, error: 'user_not_active' }

    const claims = claimsFromDbUser(user)

    const nextRid = newRefresh({
        userId: currentRefresh.user_id,
        rememberMe: currentRefresh.remember_me,
        uaHash: currentRefresh.ua_hash,
        ipHint: currentRefresh.ip_hint,
    })

    const rotated = await redisStore.rotateRefresh(currentRefresh.rid, nextRid)
    const code = (rotated as { code: number }).code

    if(!rotated.ok) {
        if (code === -1) return { ok: false, error: 'not_found' }
        if (code === -2) {
            await redisStore.revokeUserRefresh(currentRefresh.user_id).catch(() => {})
            await redisStore.revokeUserSessions(currentRefresh.user_id).catch(() => {})
            return { ok: false, error: 'reused' }
        }  
        if (code === -3) return { ok: false, error: 'ua_mismatch' }
        if (code === -4) return { ok: false, error: 'expired' }
        return { ok: false, error: 'rotation_failed' }
    }

    if(code == 1 && rotated.rid)
    {
        const nextSid = newSession(currentRefresh.user_id, claims, rotated.rid)
        await redisStore.putSession(nextSid)
        return { ok: true, sid:nextSid.sid, rid: rotated.rid }
    }

    if(code == 2 && rotated.rid)
    {
        const mintedSid = await redisStore.getSidByRid(rotated.rid)
        if(!mintedSid)
        {
            await redisStore.revokeUserRefresh(currentRefresh.user_id).catch(() => {})
            await redisStore.revokeUserSessions(currentRefresh.user_id).catch(() => {})
            return { ok: false, error: 'rotation_failed:cannot_find_sid' } 
        }
        return { ok: true, sid:mintedSid, rid: rotated.rid }    
    }
    return null
}

/* ---------------------------------------------------------------------- */

export async function login(req: NextRequest, input: LoginInput): Promise<LoginResult> {
    const user = await findUserByLogin(input.login)
    if (!user || !user.is_active) 
        return { ok: false, error: 'invalid_credentials' }

    const passOk = await verifyPassword(user.password, input.password)
    if (!passOk) 
        return { ok: false, error: 'invalid_credentials' }

    const isTempActive =
        user.force_password_change &&
        Boolean(user.temp_password_issued_at) &&
        !user.temp_password_used_at

    if (isTempActive) {
        const unusable = await hashPassword(`burn-${Date.now()}-${Math.random()}`)
        await burnTempPassword(user.id, unusable)
    }

    const claims = claimsFromDbUser(user)
    const uaHash = app.BIND_UA ? getUaHash(req) : ''
    const ipHint = getIpHint(req)

    const ridRec = newRefresh({ userId: user.id, rememberMe: input.rememberMe, uaHash, ipHint })
    await redisStore.putRefresh(ridRec)
    const sidRec = newSession(user.id, claims, ridRec.rid)
    await redisStore.putSession(sidRec)
    
    await updateLastLogin(user.id)

    return {
        ok: true,
        sid: sidRec.sid,
        rid: ridRec.rid,
        rememberMe: input.rememberMe,
        forcePasswordChange: user.force_password_change,
    }
}

/* ---------------------------------------------------------------------- */

export async function logout(req: NextRequest, mode: LogoutMode = 'device'): Promise<LogoutResult> {

    const sidCookie = req ? req.cookies.get(app.SESSION_COOKIE)?.value ?? null : (await cookies()).get(app.SESSION_COOKIE)?.value ?? null
    const ridCookie = req ? req.cookies.get(app.REFRESH_COOKIE)?.value ?? null : (await cookies()).get(app.REFRESH_COOKIE)?.value ?? null

    let userId: string | null = null
    let ridToKill: string | null = ridCookie

    if (sidCookie) {
        const s = await redisStore.getSession(sidCookie).catch(() => null)
        if (s) {
        userId = s.user_id
        if (!ridToKill && s.parent_rid) ridToKill = s.parent_rid
        }
    }
    if (!userId && ridCookie) {
        const r = await redisStore.getRefresh(ridCookie).catch(() => null)
        if (r) userId = r.user_id
    }

    if (!sidCookie && !ridCookie && !userId) {
        console.log('[AUTH-logout] no sid/rid -> nothing to do')
        return { ok: false, error: 'unauthorized:nosession' }
    }

    if (mode === 'all') {
        if (!userId) return { ok: false, error: 'user_not_found' }
        const [refreshRemoved, sessionsRemoved] = await Promise.all([
        redisStore.revokeUserRefresh(userId).catch(() => 0),
        redisStore.revokeUserSessions(userId).catch(() => 0),
        ])
        console.log('[AUTH-logout] ALL devices revoked', { userId, refreshRemoved, sessionsRemoved })
        return { ok: true, mode, revoked: { refreshRemoved, sessionsRemoved } }
    }

    if (sidCookie) {
        await redisStore.deleteSession(sidCookie).catch(() => {})
    }

    if (ridToKill) {
        await redisStore.deleteRefresh(ridToKill).catch(() => {})
    }

    console.log('[AUTH-logout] DEVICE revoked', { userId, sid: sidCookie, rid: ridToKill })
    return { ok: true, mode, revoked: { sid: sidCookie, rid: ridToKill } }
}

export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return '/'
  try {
    const u = new URL(raw, 'http://x') // dummy base to parse
    const p = u.pathname + (u.search || '')
    return p.startsWith('/') ? p : '/'
  } catch {
    return '/'
  }
}


export async function getSessionOrBridge(skip_force_change? :boolean) : Promise<SessionRecord>{
    const sses = await getCurrentSession();
    
    if(!sses)
    {
        const h = await headers()
        const currentUrl = h.get('x-url') ?? '/'
        return redirect(`/api/session-bridge?next=${encodeURIComponent(sanitizeNext(currentUrl))}&__bridged=1`)
    }
    if(!skip_force_change)
    {
        if(sses)
        {
            if(sses.claims)
            {
                const forced_change = getBoolClaim(sses.claims,'force_password_change')
                if(forced_change) 
                {
                    return redirect(`/password-change`)
                }
            }
        }
    }
    return sses
}
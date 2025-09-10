'use client'

import Image from 'next/image'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'

type State = {
  enabled: boolean
  pending: boolean

  showQR: boolean
  qrData: string | null
  qrLoading: boolean

  verificationCode: string
  verifying: boolean

  status: string | null
}

type Action =
  | { type: 'setEnabledPending'; enabled: boolean; pending: boolean }
  | { type: 'setStatus'; status: string | null }
  | { type: 'setQrLoading'; qrLoading: boolean }
  | { type: 'showQR'; show: boolean }
  | { type: 'setQrData'; data: string | null }
  | { type: 'setVerifying'; verifying: boolean }
  | { type: 'setCode'; code: string }
  | { type: 'onVerifiedSuccess' } // enabled=true, pending=false, hide QR, clear code + success msg

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setEnabledPending':
      return { ...state, enabled: action.enabled, pending: action.pending }
    case 'setStatus':
      return { ...state, status: action.status }
    case 'setQrLoading':
      return { ...state, qrLoading: action.qrLoading }
    case 'showQR':
      return { ...state, showQR: action.show }
    case 'setQrData':
      return { ...state, qrData: action.data }
    case 'setVerifying':
      return { ...state, verifying: action.verifying }
    case 'setCode':
      return { ...state, verificationCode: action.code }
    case 'onVerifiedSuccess':
      return {
        ...state,
        enabled: true,
        pending: false,
        showQR: false,
        verificationCode: '',
        status: '✅ TOTP verified and enabled.',
      }
    default:
      return state
  }
}

export default function TotpSetupCard({
  initialEnabled = false,
}: { initialEnabled?: boolean }) {
  const [state, dispatch] = useReducer(reducer, {
    enabled: !!initialEnabled,
    pending: false,

    showQR: false,
    qrData: null,
    qrLoading: false,

    verificationCode: '',
    verifying: false,

    status: null,
  })

  // Keep frequently-read values in refs for stable handlers
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeRef = useRef<string>(state.verificationCode)

  useEffect(() => {
    codeRef.current = state.verificationCode
  }, [state.verificationCode])

  // Clear QR hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [])

  const handleShowQR = useCallback(async () => {
    dispatch({ type: 'setStatus', status: null })
    dispatch({ type: 'setQrLoading', qrLoading: true })

    try {
      const res = await fetch('/api/me/totp/setup', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      type TotpSetupResponse = { ok: boolean; otpauthUrl?: string; enabled?: boolean; error?: string }
      const data = (await res.json().catch(() => ({}))) as Partial<TotpSetupResponse>

      if (!res.ok || !data?.otpauthUrl) {
        dispatch({ type: 'setStatus', status: `❌ ${data?.error ?? 'Could not get TOTP QR.'}` })
        return
      }

      // Try to render a data URL for the QR (cosmetic only)
      let dataUrl: string | null = null
      try {
        const { toDataURL } = await import('qrcode')
        dataUrl = await toDataURL(String(data.otpauthUrl), { margin: 1, width: 200 })
      } catch {
        dataUrl = null
      }

      dispatch({ type: 'setQrData', data: dataUrl || String(data.otpauthUrl) })
      dispatch({ type: 'showQR', show: true })

      // Enabled/pending status from server; pending when not enabled yet
      const isEnabled = !!data.enabled
      dispatch({ type: 'setEnabledPending', enabled: isEnabled, pending: !isEnabled })

      // Reset any existing timer then arm a new one
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => {
        dispatch({ type: 'showQR', show: false })
        dispatch({ type: 'setStatus', status: 'ℹ️ QR code hidden for safety. Click again to show it.' })
        hideTimerRef.current = null
      }, 60_000)
    } catch {
      dispatch({ type: 'setStatus', status: '❌ Could not get TOTP QR.' })
    } finally {
      dispatch({ type: 'setQrLoading', qrLoading: false })
    }
  }, [])

  const handleHideQR = useCallback(() => {
    dispatch({ type: 'showQR', show: false })
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const handleVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch({ type: 'setStatus', status: null })
    dispatch({ type: 'setVerifying', verifying: true })

    try {
      const res = await fetch('/api/me/totp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: codeRef.current }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok && result?.ok) {
        dispatch({ type: 'onVerifiedSuccess' })
      } else {
        dispatch({ type: 'setStatus', status: `❌ ${result?.error ?? 'Verification failed'}` })
      }
    } catch {
      dispatch({ type: 'setStatus', status: '❌ Verification failed.' })
    } finally {
      dispatch({ type: 'setVerifying', verifying: false })
    }
  }, [])

  const { enabled, pending, showQR, qrData, qrLoading, verificationCode, verifying, status } = state

  const verifyDisabled = useMemo(
    () => verifying || verificationCode.length !== 6,
    [verifying, verificationCode.length]
  )

  return (
    <div className="card bg-base-100 shadow-md border border-base-300 md:col-span-2">
      <div className="card-body">
        <h2 className="card-title">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm opacity-70 mb-2">
          {enabled
            ? 'TOTP is enabled for your account.'
            : pending
              ? 'Scan the QR and enter a 6-digit code to finalize.'
              : 'Add a second factor to better protect your account.'}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleShowQR}
            disabled={qrLoading || showQR}
            className="btn btn-primary btn-sm"
            title={showQR ? 'QR is visible' : (enabled ? 'Show existing QR' : 'Generate QR code')}
          >
            {qrLoading ? 'Loading…' : (enabled ? 'Show QR' : 'Show QR Code')}
          </button>

          {showQR && (
            <button onClick={handleHideQR} className="btn btn-outline btn-sm">
              Hide QR Code
            </button>
          )}
        </div>

        {showQR && qrData && (
          <div className="mt-3 text-center">
            {qrData.startsWith('data:image') ? (
              <Image
                src={qrData}
                alt="TOTP QR"
                width={200}
                height={200}
                className="inline-block border rounded p-2 bg-white"
              />
            ) : (
              <div className="alert alert-info text-xs break-all">{qrData}</div>
            )}
            <p className="text-xs mt-2 opacity-70">Scan with Google Authenticator, Authy, or another TOTP app.</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">
              <span className="label-text mb-2">Enter 6-digit code</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              value={verificationCode}
              onChange={(e) =>
                dispatch({ type: 'setCode', code: e.target.value.replace(/\D/g, '') })
              }
              className="input input-bordered w-full"
              placeholder="123456"
              required
              // unchanged semantics: allow entry while pending; when enabled, typically not needed
              disabled={!pending && !enabled}
            />
          </div>
          <button className="btn btn-success" disabled={verifyDisabled}>
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        {status && <div className="mt-3 text-sm">{status}</div>}
      </div>
    </div>
  )
}

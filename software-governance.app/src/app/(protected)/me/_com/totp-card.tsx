'use client'

import { useEffect, useState } from 'react'

export default function TotpSetupCard({ initialEnabled = false }: { initialEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(!!initialEnabled)
  const [pending, setPending] = useState(false)

  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrHideTimer, setQrHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => () => { if (qrHideTimer) clearTimeout(qrHideTimer) }, [qrHideTimer])

  async function handleShowQR() {
    setStatus(null)
    setQrLoading(true)
    try {
      const res = await fetch('/api/me/totp/setup', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data?.otpauthUrl) {
        setStatus(`❌ ${data?.error ?? 'Could not get TOTP QR.'}`)
        return
      }

      // Build a data URL for nicer rendering if possible
      let dataUrl: string | null = null
      try {
        const { toDataURL } = await import('qrcode')
        dataUrl = await toDataURL(String(data.otpauthUrl), { margin: 1, width: 200 })
      } catch {
        dataUrl = null
      }

      setQrData(dataUrl || String(data.otpauthUrl))
      setShowQR(true)

      // Use server's enabled flag
      const isEnabled = !!data.enabled
      setEnabled(isEnabled)
      setPending(!isEnabled) // pending only when not enabled yet

      if (qrHideTimer) clearTimeout(qrHideTimer)
      setQrHideTimer(setTimeout(() => {
        setShowQR(false)
        setStatus('ℹ️ QR code hidden for safety. Click again to show it.')
      }, 60_000))
    } catch {
      setStatus('❌ Could not get TOTP QR.')
    } finally {
      setQrLoading(false)
    }
  }

  function handleHideQR() {
    setShowQR(false)
    if (qrHideTimer) clearTimeout(qrHideTimer)
    setQrHideTimer(null)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/me/totp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok && result?.ok) {
        setEnabled(true)
        setPending(false)
        setShowQR(false)
        setVerificationCode('')
        setStatus('✅ TOTP verified and enabled.')
      } else {
        setStatus(`❌ ${result?.error ?? 'Verification failed'}`)
      }
    } catch {
      setStatus('❌ Verification failed.')
    } finally {
      setVerifying(false)
    }
  }

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
              <img src={qrData} alt="TOTP QR" className="inline-block border rounded p-2 bg-white" />
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
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="input input-bordered w-full"
              placeholder="123456"
              required
              disabled={!pending && !enabled} // allow entry in pending; when enabled, typically not needed
            />
          </div>
          <button className="btn btn-success" disabled={verifying || verificationCode.length !== 6}>
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        {status && <div className="mt-3 text-sm">{status}</div>}
      </div>
    </div>
  )
}

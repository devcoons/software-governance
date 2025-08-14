'use client'

import { useEffect, useState } from 'react'

export default function TotpSetupCard({ initialEnabled = false }: { initialEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(!!initialEnabled)

  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrHideTimer, setQrHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (qrHideTimer) clearTimeout(qrHideTimer)
    }
  }, [qrHideTimer])

  async function handleShowQR() {
    setStatus(null)
    setQrLoading(true)
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'GET', cache: 'no-store' })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data?.otpauthUrl) {
        setStatus(data?.error ? `❌ ${data.error}` : '❌ Could not start TOTP setup.')
        return
      }

      const otpauthUrl = String(data.otpauthUrl || '')
      let dataUrl: string | null = null
      try {
        const { toDataURL } = await import('qrcode')
        dataUrl = await toDataURL(otpauthUrl, { margin: 1, width: 200 })
      } catch {
        dataUrl = null
      }

      setQrData(dataUrl || otpauthUrl)
      setShowQR(true)
      setEnabled(true)

      if (qrHideTimer) clearTimeout(qrHideTimer)
      setQrHideTimer(
        setTimeout(() => {
          setShowQR(false)
        }, 7000)
      )
    } catch {
      setStatus('❌ Could not start TOTP setup.')
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
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok && result?.ok) {
        setEnabled(true)
        setStatus('✅ TOTP verified.')
      } else {
        const msg = result?.error || 'Verification failed'
        setStatus(`❌ ${msg}`)
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
            : 'Add a second factor to better protect your account.'}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleShowQR}
            disabled={qrLoading || showQR}
            className="btn btn-primary btn-sm"
            title={showQR ? 'QR is visible' : 'Generate QR code'}
          >
            {qrLoading ? 'Loading…' : 'Show QR Code'}
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
            <p className="text-xs mt-2 opacity-70">
              Scan with Google Authenticator, Authy, or another TOTP app.
            </p>
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

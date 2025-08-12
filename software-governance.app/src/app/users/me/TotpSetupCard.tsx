'use client';

import { useState, useEffect } from 'react';

export default function TotpSetupCard({ initialEnabled = false }: { initialEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(!!initialEnabled);

  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);        // <-- separate
  const [qrHideTimer, setQrHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);        // <-- separate
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => () => { if (qrHideTimer) clearTimeout(qrHideTimer); }, [qrHideTimer]);

  async function handleShowQR() {
    setStatus(null);
    setQrLoading(true);
    try {
      const res = await fetch('/api/totp/setup', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQrData(data.qr || null);
      setShowQR(true);

      if (qrHideTimer) clearTimeout(qrHideTimer);
      setQrHideTimer(setTimeout(() => setShowQR(false), 7000));
    } catch {
      setStatus('❌ Could not load QR code.');
    } finally {
      setQrLoading(false);
    }
  }

  function handleHideQR() {
    setShowQR(false);
    if (qrHideTimer) clearTimeout(qrHideTimer);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setVerifying(true);
    try {
      const res = await fetch('/api/totp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.ok) {
        setEnabled(true);
        setStatus('✅ Verified.');
      } else {
        setStatus(`❌ ${result.message || 'Verification failed'}`);
      }
    } catch {
      setStatus('❌ Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-md border border-base-300 md:col-span-2">
      <div className="card-body">
        <h2 className="card-title">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm opacity-70 mb-2">
          {enabled ? 'TOTP is enabled for your account.' : 'Add a second factor to better protect your account.'}
        </p>

        {/* QR controls */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleShowQR}
            disabled={qrLoading}
            className="btn btn-primary btn-sm"
          >
            {qrLoading ? 'Loading…' : 'Show QR Code'}
          </button>
          {showQR && (
            <button onClick={handleHideQR} className="btn btn-outline btn-sm">
              Hide QR Code
            </button>
          )}
        </div>

        {/* QR display */}
        {showQR && qrData && (
          <div className="mt-3">
            <img src={qrData} alt="TOTP QR" className="border rounded p-2 bg-white" />
            <p className="text-xs mt-2 opacity-70">Scan with Google Authenticator, Authy, or another TOTP app.</p>
          </div>
        )}

        {/* Verification form */}
        <form onSubmit={handleVerify} className="mt-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">
              <span className="label-text">Enter 6-digit code</span>
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
          <button
            className="btn btn-success"
            disabled={verifying || verificationCode.length !== 6}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        {status && <div className="mt-3 text-sm">{status}</div>}
      </div>
    </div>
  );
}

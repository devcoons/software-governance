'use client';

import { useState } from 'react';

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

async function handleChangePassword(e: React.FormEvent) {
  e.preventDefault();
  if (newPassword !== confirmPassword) {
    setStatus('❌ New passwords do not match.');
    return;
  }
  setStatus(null);
  setBusy(true);

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Use the API's error if provided, otherwise generic
      const msg = data?.error ?? 'Failed to update password.';
      setStatus(`❌ ${msg}`);
      return;
    }

    setStatus('✅ Password successfully updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

  } catch (err: any) {
    setStatus(`❌ ${err.message ?? 'Unexpected error occurred.'}`);
  } finally {
    setBusy(false);
  }
}


  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input input-bordered w-full"
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input input-bordered w-full"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input input-bordered w-full"
            required
          />
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Updating…' : 'Change Password'}
          </button>
        </form>
        {status && <p className="text-sm mt-3">{status}</p>}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export default function ResetPasswordButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Reset password for ${email}?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.tempPassword) {
        alert(
          `Temporary password for ${email}:\n\n${d.tempPassword}\n\nThe user will be forced to change it at next login.`
        );
      } else {
        alert(d?.error ?? 'Failed to reset password');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-xs" onClick={onClick} disabled={busy}>
      {busy ? 'Resetting…' : 'Reset password'}
    </button>
  );
}

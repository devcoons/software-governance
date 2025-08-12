'use client';

import { useCallback, useState } from 'react';

export default function ForcePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get('currentPassword') || '');
    const newPassword = String(fd.get('newPassword') || '');
    const confirmPassword = String(fd.get('confirmPassword') || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 10) {
      setError('New password is too short (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users/force-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        cache: 'no-store',
        // credentials are sent by default for same-origin; explicit not required
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Failed to update password.');
        setSubmitting(false);
        return;
      }

      // Server clears sid/rid + fp cookies; just go to login
      window.location.replace(data.redirect ?? '/login');
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }, []);

  return (
    <form onSubmit={onSubmit} className="card bg-base-100 shadow-xl p-6 gap-3">
      <h1 className="text-xl font-semibold">Change your password</h1>
      <p className="text-sm opacity-70 mb-2">You must update your password before continuing.</p>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      <label className="form-control w-full">
        <span className="label-text">Current password</span>
        <input
          name="currentPassword"
          type="password"
          className="input input-bordered w-full"
          autoComplete="current-password"
          required
          disabled={submitting}
          autoFocus
        />
      </label>

      <label className="form-control w-full">
        <span className="label-text">New password</span>
        <input
          name="newPassword"
          type="password"
          className="input input-bordered w-full"
          autoComplete="new-password"
          minLength={10}
          required
          disabled={submitting}
        />
        <span className="label-text-alt mt-1">Minimum 10 characters.</span>
      </label>

      <label className="form-control w-full">
        <span className="label-text">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          className="input input-bordered w-full"
          autoComplete="new-password"
          minLength={10}
          required
          disabled={submitting}
        />
      </label>

      <button className="btn btn-primary w-full mt-2" type="submit" disabled={submitting}>
        {submitting ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
}

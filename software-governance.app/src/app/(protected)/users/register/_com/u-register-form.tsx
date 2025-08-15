'use client';

import { useRef, useState } from 'react';

type CreateUserOk = { ok: true; password: string };
type CreateUserErr = { ok: false; error?: string };
type CreateUserResponse = CreateUserOk | CreateUserErr;

function isCreateUserOk(x: unknown): x is CreateUserOk {
  return !!x && typeof x === 'object' && (x as any).ok === true && typeof (x as any).password === 'string';
}

export default function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempInfo, setTempInfo] = useState<{ email: string; password: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const role = String(fd.get('role') || 'user');

    if (!email) { setError('Email is required.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Invalid email.'); return; }
    if (!['admin', 'user', 'viewer'].includes(role)) { setError('Invalid role.'); return; }

    setPending(true);

    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Always force first-login password change
        body: JSON.stringify({ email, role}),
        // Avoid browser caching weirdness and proxies
        cache: 'no-store',
      });

      let data: unknown = {};
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        const errMsg = (data as CreateUserErr)?.error;
        setError(errMsg || `Failed to create user (${res.status}).`);
        return;
      }

      if (!isCreateUserOk(data)) {
        setError('User created, but no temporary password was returned.');
        return;
      }

      setTempInfo({ email: email, password: data.password });
      dialogRef.current?.showModal?.();
      form.reset();
    } catch (err: any) {
      // If server actually processed it, a retry guard on backend prevents duplicates.
      setError('Network error. Please check connection and try again.');
      console.error('create user error', err);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="grid gap-5" onSubmit={onSubmit} noValidate>
        {error && <div role="alert" className="alert alert-error text-sm">{error}</div>}

        {/* Email */}
        <label className="form-control w-full">
          <h3 className="label-text font-semibold mb-2">Email</h3>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input input-bordered w-full"
            placeholder="user@example.com"
            required
            disabled={pending}
          />
        </label>

        {/* Role */}
        <fieldset className="form-control">
          <legend className="label-text font-semibold mb-2">Role</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: 'user', label: 'User', hint: 'Standard access' },
              { value: 'admin', label: 'Admin', hint: 'Full access' },
              { value: 'viewer', label: 'Viewer', hint: 'Read-only' },
            ].map(({ value, label, hint }) => (
              <label
                key={value}
                className="flex items-start gap-3 p-3 rounded-lg shadow-sm hover:shadow-md transition
                           focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/50 bg-base-100"
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  className="radio mt-0.5"
                  defaultChecked={value === 'user'}
                  required
                  disabled={pending}
                />
                <span className="leading-tight">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs opacity-70">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <span className="label-text-alt mt-2 block text-sm opacity-70">
            You can change the role later from the Users overview.
          </span>
        </fieldset>

        {/* Actions */}
        <div className="pt-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>

      {/* Modal */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg">User created successfully</h3>
          <p className="py-2 text-sm opacity-80">
            Share the temporary password securely. The user will be required to change it at first login.
          </p>

          <div className="card bg-base-200 shadow-inner mt-4">
            <div className="card-body gap-3">
              <div>
                <span className="text-xs opacity-70">Email</span>
                <div className="font-mono text-sm">{tempInfo?.email}</div>
              </div>
              <div>
                <span className="text-xs opacity-70">Temporary password</span>
                <code className="font-mono text-sm select-all block">{tempInfo?.password}</code>
              </div>
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dialogRef.current?.close();
                window.location.href = '/users';
              }}
            >
              Done
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close">close</button>
        </form>
      </dialog>
    </>
  );
}

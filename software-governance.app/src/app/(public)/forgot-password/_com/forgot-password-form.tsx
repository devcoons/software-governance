// src/app/(public)/forgot-password/_com/ForgotPasswordForm.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Expected server endpoint (to add next):
 * POST /api/auth/forgot
 * body: { username: string; newPassword: string; totp: string }
 * success: { ok: true }
 * error: { ok: false; error: "invalid_totp" | "rate_limited" | "weak_password" | "user_not_found" | "not_allowed" | "unknown" }
 *
 * UI intentionally avoids leaking whether a user exists.
 */

export default function ForgotPasswordForm() {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "").trim();
    const newPassword = String(fd.get("new_password") || "");
    const confirmPassword = String(fd.get("confirm_password") || "");
    const totp = String(fd.get("totp") || "").replace(/\D/g, ""); // digits only

    if (!username) return setError("Username is required.");
    if (!newPassword) return setError("New password is required.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    if (!isSanePassword(newPassword)) {
      return setError(
        "Password must be at least 10 characters and include at least two of: uppercase, lowercase, digits, symbols."
      );
    }
    if (!/^\d{6}$/.test(totp)) return setError("Enter a valid 6-digit authenticator code.");

    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, newPassword, totp }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        const code = (data?.error || "unknown") as string;
        switch (code) {
          case "invalid_totp":
            setError("The authenticator code is invalid or expired.");
            break;
          case "weak_password":
            setError("The new password does not meet the security requirements.");
            break;
          case "rate_limited":
            setError("Too many attempts. Please try again in a few minutes.");
            break;
          case "not_allowed":
            setError("Password reset is not allowed for this account.");
            break;
          case "user_not_found":
          case "unknown":
          default:
            setError("We couldn’t complete the reset. Check your details and try again.");
            break;
        }
        return;
      }

      setNotice("If the details were correct, your password has been updated.");
      setTimeout(() => router.push("/login?reset=ok"), 600);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Username</span>
        </label>
        <input
          name="username"
          autoComplete="username"
          type="text"
          className="input input-bordered w-full"
          placeholder="your.username"
          disabled={pending}
          required
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">New password</span>
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="btn btn-ghost btn-xs"
            aria-pressed={showPw}
            title={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </label>
        <input
          name="new_password"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          className="input input-bordered w-full"
          placeholder="********"
          disabled={pending}
          required
          minLength={10}
        />
        <p className="text-xs opacity-70 mt-1">
          At least 10 chars and 2 of: upper, lower, digits, symbols.
        </p>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Confirm new password</span>
        </label>
        <input
          name="confirm_password"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          className="input input-bordered w-full"
          placeholder="********"
          disabled={pending}
          required
          minLength={10}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Authenticator code (TOTP)</span>
        </label>
        <input
          name="totp"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          className="input input-bordered w-full tracking-widest"
          placeholder="123456"
          disabled={pending}
          required
          aria-describedby="totp-help"
        />
        <p id="totp-help" className="text-xs opacity-70 mt-1">
          6-digit code from your authenticator app.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="alert alert-info">
          <span>{notice}</span>
        </div>
      )}

      <div className="form-control">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <span className="loading loading-spinner loading-sm" aria-hidden /> : null}
          <span className={pending ? "ml-2" : ""}>Reset password</span>
        </button>
      </div>
    </form>
  );
}

// ————— helpers —————

function isSanePassword(pw: string): boolean {
  if (pw.length < 10) return false;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  return classes >= 2;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

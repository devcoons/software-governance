// src/app/(public)/forgot-password/page.tsx
import Link from "next/link";
import ForgotPasswordForm from "./_com/forgot-password-form";

export const runtime = "nodejs";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen w-full grid place-items-center bg-base-200">
      <div className="w-full max-w-md p-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="text-2xl font-bold">Reset password</h1>
            <p className="text-sm opacity-70">
              Enter your username, choose a new password, and confirm with your authenticator code.
            </p>

            <ForgotPasswordForm />

            <div className="divider my-2" />
            <p className="text-center text-sm">
              <Link className="link" href="/login">Back to login</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// src/app/api/auth/forgot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithTotp } from "@/server/auth/service";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().min(1).max(128),
  newPassword: z.string().min(10), // full policy is applied in the service
  totp: z.string().regex(/^\d{6}$/),
});

type ErrCode =
  | "invalid_totp"
  | "weak_password"
  | "rate_limited"
  | "not_allowed"
  | "unknown";

export async function POST(req: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Forward a minimal IP hint if available (optional)
  const ipHint =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
 
    (req as any).ip ||
    undefined;

  const res = await resetPasswordWithTotp(
    body.username,
    body.newPassword,
    body.totp,
    ipHint
  );

  if (res.ok) {
    // Do not leak user existence; success is generic.
    return NextResponse.json({ ok: true });
  }

  const code = (res.error || "unknown") as ErrCode;

  // Map to HTTP status without leaking account state.
  const status =
    code === "rate_limited" ? 429 :
    code === "invalid_totp" || code === "weak_password" || code === "not_allowed"
      ? 400
      : 400;

  return NextResponse.json({ ok: false, error: code }, { status });
}

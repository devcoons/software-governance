'use client'

import { SessionClaims } from "@/server/auth/types";


function getStringArrayClaim(claims: unknown, key: string): string[] {
  if (typeof claims !== 'object' || claims === null) return [];
  const v = (claims as Record<string, unknown>)[key];
  if (Array.isArray(v)) {
    // Allow string arrays; coerce other element types to strings defensively
    return v.filter(x => typeof x === 'string') as string[];
  }
  // Some backends encode arrays as comma-separated strings; accept that too
  if (typeof v === 'string') {
    const arr = v.split(',').map(s => s.trim()).filter(Boolean);
    return arr;
  }
  return [];
}

export default function AccountCard(details: {sid: string, user_id: string, claims: SessionClaims | undefined}) {

    const email = (() => {
        const c = details.claims as unknown;
        if (typeof c !== 'object' || c === null) return undefined;
        const v = (c as { email?: unknown }).email;
        return typeof v === 'string' ? v : undefined;
    })();

const roles = getStringArrayClaim(details.claims, 'roles');           // e.g. ["admin","user"]
const permissions = getStringArrayClaim(details.claims, 'permissions');
    return (
    <div className="card bg-base-100 shadow-md border border-base-300 ">
        <div className="card-body">
            <h2 className="card-title">Account Details</h2>
            <p className="text-sm opacity-70 mb-4">Welcome, {email}</p>
            <ul className="text-sm space-y-2">
                <li><span className="font-medium">User ID:</span> </li>
                <li><div className="badge badge-neutral">{details.user_id}</div></li>
                <li><span className="font-medium">Roles:</span></li>
                <li>
                    {roles.length ? (
                    <span className="inline-flex flex-wrap gap-2 align-middle">
                    {roles.map((r) => (
                    <span key={r} className="badge badge-primary">{r}</span>
                    ))}
                    </span>
                    ) : (
                    <span className="opacity-70">(none)</span>
                    )}
                </li>
                <li><span className="font-medium">Permissions:</span></li>
                <li>
                    {permissions.length ? (
                    <span className="inline-flex flex-wrap gap-2 align-middle">
                    {permissions.map((r) => (
                    <span key={r} className="badge badge-success">{r}</span>
                    ))}
                    </span>
                    ) : (
                    <span className="opacity-70">(none)</span>
                    )}
                </li>
            </ul>
        </div>
    </div>
    );
}
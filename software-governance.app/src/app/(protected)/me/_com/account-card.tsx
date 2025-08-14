'use client'

import { SessionClaims } from "@/server/session/claims";

export default function AccountCard(details: {sid: string, user_id: string, claims: SessionClaims | undefined}) {
    return (
    <div className="card bg-base-100 shadow-md border border-base-300 ">
        <div className="card-body">
            <h2 className="card-title">Account Details</h2>
            <p className="text-sm opacity-70 mb-4">Welcome, {details.claims?.email}</p>
            <ul className="text-sm space-y-2">
                <li><span className="font-medium">User ID:</span> </li>
                <li><div className="badge badge-neutral">{details.user_id}</div></li>
                <li><span className="font-medium">Roles:</span></li>
                <li>
                    {details.claims?.roles.length ? (
                    <span className="inline-flex flex-wrap gap-2 align-middle">
                    {details.claims?.roles.map((r) => (
                    <span key={r} className="badge badge-primary">{r}</span>
                    ))}
                    </span>
                    ) : (
                    <span className="opacity-70">(none)</span>
                    )}
                </li>
                <li><span className="font-medium">Permissions:</span></li>
                <li>
                    {details.claims?.permissions.length ? (
                    <span className="inline-flex flex-wrap gap-2 align-middle">
                    {details.claims?.permissions.map((r) => (
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
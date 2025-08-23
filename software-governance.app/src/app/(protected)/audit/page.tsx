/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome';
import { toSessionView } from '@/app/_com/utils';
import { getSessionOrBridge } from '@/server/auth/ctx';
import { listAllAuditLogs } from '@/server/db/mysql-queries.select';
import { AuditLogVisual } from '@/server/db/mysql-types';
import LogsTable from './_com/logs-table';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Audit' }
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

function fmtWhen(at: string | null): string {
    if (!at) return "-";
    const d = new Date(at);
    return Number.isFinite(d.valueOf()) ? d.toLocaleString() : at;
}

/* ---------------------------------------------------------------------- */

function actorLabel(username: string | null, userId: string | null): string {
    if (username && userId) return `${username}(${userId})`;
    if (username) return username;
    if (userId) return `(${userId})`;
    return "-";
}

/* ---------------------------------------------------------------------- */

function renderMeta(meta: string) {
    try {
        const parsed = JSON.parse(meta);
        return <pre className="text-xs overflow-x-auto">{JSON.stringify(parsed, null, 2)}</pre>;
    } catch {
        return <pre className="text-xs overflow-x-auto">{meta}</pre>;
    }
}

/* ---------------------------------------------------------------------- */

export default async function AuditLogsPage() {
    
    const session = await getSessionOrBridge(); 
    const sessionView = toSessionView(session);
    const logs : AuditLogVisual[]= await listAllAuditLogs()

    return (
    <Chrome session={sessionView}>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
        <div className="card bg-base-100 shadow-md border border-base-300">
        <LogsTable logs={logs}/>
        </div>
      </div>
    </Chrome>
    );
}


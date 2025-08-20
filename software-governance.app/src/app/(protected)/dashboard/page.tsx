/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome';
import { toSessionView } from '@/app/_com/utils';
import { getSessionOrBridge } from '@/server/auth/ctx';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function Page() {
    console.log("[ PG-/dashboard 0]")

    const session = await getSessionOrBridge(); 
    console.log("[ PG-/dashboard 1]")   
    const sessionView = toSessionView(session);
    console.log("[ PG-/dashboard 2]")
    return (
    <Chrome session={sessionView}>
        <h1 className="mb-4 text-xl">Dashboard</h1>
        <pre className="whitespace-pre-wrap text-sm border p-3 bg-gray-50"/>  
    </Chrome>
    )
}


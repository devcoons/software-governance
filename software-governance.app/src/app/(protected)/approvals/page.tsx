/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome';
import ChromeLight from '@/app/_com/chrome-light';
import { toSessionView } from '@/app/_com/utils';
import { getSessionOrBridge } from '@/server/auth/ctx';

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Approvals' }
export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------- */

export default async function SoftwareRegistryPage() {
    
    const session = await getSessionOrBridge(); 
    const sessionView = toSessionView(session);

    return (
    <Chrome session={sessionView}>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-16 py-8">
        <h1 className="text-2xl font-bold mb-6">Approvals</h1>
        <div className="card bg-base-100 shadow-md border border-base-300">
         <span className='py-8 px-16'>To Implement</span>
        </div>
      </div>
    </Chrome>
    );
}


/* page.tsx */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

import Chrome from '@/app/_com/chrome'
import { getSession } from '@/server/auth/ctx'

/* ---------------------------------------------------------------------- */

export const metadata = { title: 'Dashboard' }

/* ---------------------------------------------------------------------- */

export default async function Page() {
  const sess = await getSession()
  return (
    <Chrome>
      <h1 className="mb-4 text-xl">Compliance</h1>
      <pre className="whitespace-pre-wrap text-sm border p-3 bg-gray-50">
      
      </pre>
    </Chrome>
  )
}

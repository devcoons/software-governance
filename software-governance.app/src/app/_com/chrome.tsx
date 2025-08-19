/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-footer.tsx */
/* ---------------------------------------------------------------------- */

import NavBar from './chrome-navbar'
import FooterBar from './chrome-footer'
import { AppSessionClaims } from '@/server/auth/types'
import { SessionView } from '@/server/auth/session-view'

/* ---------------------------------------------------------------------- */


type ChromeProps = {
  children: React.ReactNode
  session: SessionView
}

export default async function Chrome({ children, session }: ChromeProps) {
                                        
	return (
    <div className="min-h-svh flex flex-col">
		<NavBar session={session}/> 
		<main className="flex-1">{children}</main>
		<FooterBar/>
    </div>
	);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

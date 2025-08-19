/* ---------------------------------------------------------------------- */
/* Filepath: src/app/_com/chrome-light.tsx */
/* ---------------------------------------------------------------------- */

import FooterBar from './chrome-footer'

/* ---------------------------------------------------------------------- */

export default async function ChromeLight({ children }: 
										  { children: React.ReactNode }) {
	return(
    <div className="min-h-svh flex flex-col">
		<main className="flex-1">{children}</main>
		<FooterBar/>
    </div>
	);
}

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

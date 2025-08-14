// src/components/chrome.tsx

import NavBar from './chrome-navbar'
import FooterBar from './chrome-footer'

export default async function Chrome({ children }: { children: React.ReactNode }) {


  return (
    <div className="min-h-svh flex flex-col">
      <NavBar /> 
      <main className="flex-1">{children}</main>
      <FooterBar />
    </div>
  );
}

// src/app/layout.tsx
import './globals.css';
import RouteLoadingOverlay from './RouteLoadingOverlay';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sgov">
      <body className="min-h-svh flex flex-col">
         <RouteLoadingOverlay />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

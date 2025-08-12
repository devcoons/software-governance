// src/app/layout.tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sgov">
      <body className="min-h-svh flex flex-col">
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

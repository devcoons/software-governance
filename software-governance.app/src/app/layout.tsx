import './globals.css';
import RouteLoadingOverlay from './RouteLoadingOverlay';
import Providers from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sgov">
      <body className="min-h-svh flex flex-col">
        <RouteLoadingOverlay />
        <Providers>
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

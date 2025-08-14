import './globals.css';
import RouteLoadingOverlay from './_com/global-loading';
import { ManualLoadingProvider } from './_com/manual-loading';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sgov">
      <body className="min-h-svh flex flex-col">
        <RouteLoadingOverlay />
        <ManualLoadingProvider>
          <main className="flex-1">{children}</main>
     </ManualLoadingProvider>
      </body>
    </html>
  );
}

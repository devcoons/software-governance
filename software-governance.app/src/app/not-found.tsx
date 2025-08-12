// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-svh flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="opacity-70">The page you’re looking for doesn’t exist.</p>
        <div className="flex gap-3 justify-center">
          <Link className="btn btn-primary" href="/">Go to something that exists..</Link>
        </div>
      </div>
    </main>
  );
}

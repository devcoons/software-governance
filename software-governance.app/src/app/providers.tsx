'use client';

import { ManualLoadingProvider } from '@/components/ManualLoadingOverlay';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ManualLoadingProvider>{children}</ManualLoadingProvider>;
}

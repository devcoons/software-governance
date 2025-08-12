'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type ManualLoadingCtx = {
  show: () => void;
  hide: () => void;
  /** Utility: await a promise while showing overlay, always hides */
  withOverlay<T>(fn: () => Promise<T>): Promise<T>;
};

const Ctx = createContext<ManualLoadingCtx | null>(null);

export function ManualLoadingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const api = useMemo<ManualLoadingCtx>(() => ({
    show: () => setVisible(true),
    hide: () => setVisible(false),
    withOverlay: async <T,>(fn: () => Promise<T>) => {
      setVisible(true);
      try { return await fn(); }
      finally { setVisible(false); }
    },
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      {visible && typeof window !== 'undefined' && createPortal(
        <div
          // very high z-index to beat modals/backdrops
          className="fixed inset-0 z-[10000] grid place-items-center bg-base-200/45 backdrop-blur-[2px]"
          aria-live="polite"
          role="status"
        >
          <div className="card bg-base-100 shadow-xl p-6 flex items-center gap-3">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Processing…</span>
          </div>
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
}

export function useManualLoading() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useManualLoading must be used within <ManualLoadingProvider>');
  return ctx;
}

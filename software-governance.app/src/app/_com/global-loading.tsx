'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function RouteLoadingOverlay() {
  const pathname = usePathname();
  const search = useSearchParams();

  const [visible, setVisible] = useState(false);

  // timers / refs
  const slowShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minVisibleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navActive = useRef(false);
  const lastUrl = useRef<string>('');

  // tuning
  const SLOW_NAV_MS = 220;     // only show for navs slower than this
  const MIN_VISIBLE_MS = 160;  // once visible, keep for at least this
  const COOLDOWN_MS = 300;     // ignore new starts briefly after hide
  const STALL_MS = 1500;       // hard fail-safe if URL never changes

  const currentUrl = () => pathname + (search?.toString() ? `?${search}` : '');

  const clearAll = () => {
    if (slowShowTimer.current) { clearTimeout(slowShowTimer.current); slowShowTimer.current = null; }
    if (minVisibleTimer.current) { clearTimeout(minVisibleTimer.current); minVisibleTimer.current = null; }
    if (cooldownTimer.current) { clearTimeout(cooldownTimer.current); cooldownTimer.current = null; }
    if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null; }
  };

  const inCooldown = () => !!cooldownTimer.current;

  const scheduleShowIfSlow = () => {
    // don’t schedule during cooldown
    if (inCooldown()) return;
    if (slowShowTimer.current) return;
    slowShowTimer.current = setTimeout(() => {
      slowShowTimer.current = null;
      // still in a navigation? show
      if (navActive.current) {
        setVisible(true);
        // fail-safe in case URL never changes
        stallTimer.current = setTimeout(forceHide, STALL_MS);
      }
    }, SLOW_NAV_MS);
  };

  const forceHide = () => {
    setVisible(false);
    // start cooldown to avoid immediate re-show (redirect chains)
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => {
      cooldownTimer.current = null;
    }, COOLDOWN_MS);
  };

  const beginNavTo = (href: string | null) => {
    if (!href) return;
    // normalize target (relative allowed)
    try {
      const u = new URL(href, window.location.origin);
      const target = u.pathname + u.search;
      const current = window.location.pathname + window.location.search;
      if (target === current) return; // same URL → ignore
    } catch {
      return;
    }
    navActive.current = true;
    // only show if it turns out slow
    scheduleShowIfSlow();
  };

  // detect nav starts
  useEffect(() => {
    lastUrl.current = currentUrl();

    function onAnchorClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest('a') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href');
      const target = a.getAttribute('target');
      if (!href || target === '_blank') return;
      if (!href.startsWith('/')) return; // external/hash/mailto
      beginNavTo(href);
    }

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      const urlArg = (args[2] ?? '').toString();
      beginNavTo(urlArg);
      return origPush(...args);
    };
    history.replaceState = (...args) => {
      const urlArg = (args[2] ?? '').toString();
      beginNavTo(urlArg);
      return origReplace(...args);
    };

    const onPopState = () => beginNavTo(document.location.pathname + document.location.search);

    // hard navigations (window.location / reload)
    const onBeforeUnload = () => {
      // immediate show for true full navigations
      setVisible(true);
    };

    document.addEventListener('click', onAnchorClick, { capture: true });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('click', onAnchorClick, { capture: true } as any);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload as any);
      history.pushState = origPush;
      history.replaceState = origReplace;
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // settle on URL change
  useEffect(() => {
    const now = currentUrl();
    if (navActive.current && now !== lastUrl.current) {
      navActive.current = false;
      lastUrl.current = now;

      // cancel “show if slow” if it never fired
      if (slowShowTimer.current) {
        clearTimeout(slowShowTimer.current);
        slowShowTimer.current = null;
      }

      // if not visible (fast nav), nothing to do
      if (!visible) {
        // still guard against a chain of redirects -> short cooldown
        if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
        cooldownTimer.current = setTimeout(() => { cooldownTimer.current = null; }, COOLDOWN_MS);
        return;
      }

      // visible: honor min visible window, then hide
      if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null; }
      if (minVisibleTimer.current) clearTimeout(minVisibleTimer.current);
      minVisibleTimer.current = setTimeout(() => {
        setVisible(false);
        // cooldown after hide
        if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
        cooldownTimer.current = setTimeout(() => { cooldownTimer.current = null; }, COOLDOWN_MS);
      }, MIN_VISIBLE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-base-200/45 backdrop-blur-[2px] pointer-events-none">
      <div className="card bg-base-100 shadow-xl p-6 flex items-center gap-3">
        <span className="loading loading-spinner loading-md" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

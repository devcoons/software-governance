import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

function buildCSP() {
  // If you later load assets from CDNs, add them to the relevant directives.
  // Example: img-src 'self' https://cdn.example.com data: blob:;
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",            // disallow embedding (also set X-Frame-Options)
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Next.js/Tailwind often injects inline styles; keep 'unsafe-inline' for styles.
    "style-src 'self' 'unsafe-inline'",
    // Scripts: strict in prod; dev needs 'unsafe-eval' for React Refresh + HMR
    `script-src 'self'${isProd ? '' : " 'unsafe-eval' 'unsafe-inline'"}`,
    // Only allow your own APIs; dev needs ws: for HMR
    `connect-src 'self'${isProd ? '' : ' ws:'}`,
    "frame-src 'self'",                  // if you embed nothing, you can drop this
    "base-uri 'self'",
  ];

  return directives.join('; ');
}

const securityHeaders = (): { key: string; value: string }[] => {
  const headers: { key: string; value: string }[] = [
    // CSP: strict in prod, report-only in non-prod so you can iterate safely
    {
      key: isProd ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value: buildCSP(),
    },
    // Legacy defense-in-depth (redundant with frame-ancestors but good for older UAs)
    { key: 'X-Frame-Options', value: 'DENY' },
    // Don’t leak referrers anywhere
    { key: 'Referrer-Policy', value: 'no-referrer' },
    // Lock down powerful APIs (expand as needed)
    {
      key: 'Permissions-Policy',
      // disable everything you don’t use; add/remove features as needed
      value:
        'accelerometer=(), ambient-light-sensor=(), autoplay=(), camera=(), ' +
        'encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), ' +
        'magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), ' +
        'publickey-credentials-get=(self), usb=(), vr=(), xr-spatial-tracking=()',
    },
    // Common hardening
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // HSTS only in prod + only if you serve over HTTPS (including behind a proxy)
    // Adjust max-age as you like; add "preload" only once you’re sure.
    ...(isProd
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
      : []),
  ];

  return headers;
};

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
  async headers() {
    return [
      {
        source: '/(.*)',   // apply to everything
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to THIS project. A stray lockfile in the parent
  // (C:\Users\Eshwa) made Next infer the wrong root, which scattered the
  // Turbopack cache and left stale CSS being served. Pinning fixes both.
  turbopack: { root: __dirname },

  // mammoth uses dynamic requires — keep external so bundler doesn't break it
  serverExternalPackages: ["mammoth"],

  // ── Image optimisation ──────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.greenhouse.io" },
      { protocol: "https", hostname: "**.lever.co" },
      { protocol: "https", hostname: "**.ashbyhq.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "**.workable.com" },
      { protocol: "https", hostname: "**.workday.com" },
    ],
    minimumCacheTTL: 86400, // cache optimised images for 24 h
  },

  // ── Compiler options ────────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // ── Experimental ────────────────────────────────────────────────────────
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },

  // ── Security + performance HTTP headers ─────────────────────────────────
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control",        value: "on" },
      { key: "X-Frame-Options",               value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options",        value: "nosniff" },
      { key: "Referrer-Policy",               value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy",            value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'",   // Next.js needs unsafe-eval in dev
          "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
          "img-src 'self' data: blob: https: http:",
          "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://api.anthropic.com",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];

    // NOTE: an immutable Cache-Control on /_next/static breaks dev — the browser
    // caches HMR chunks forever and never picks up edits. Only apply it in
    // production builds, where Next.js content-hashes those filenames so a
    // year-long immutable cache is correct.
    const isProd = process.env.NODE_ENV === "production"

    return [
      { source: "/(.*)", headers: securityHeaders },
      // Long-lived cache for static assets (production only — see note above)
      ...(isProd
        ? [{
            source: "/_next/static/(.*)",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
          }]
        : []),
      // API routes: no cache by default
      {
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  // ── Redirects ───────────────────────────────────────────────────────────
  // NOTE: do NOT add an unconditional "/" -> "/dashboard" redirect here.
  // src/middleware.ts gates /dashboard/* and sends unauthenticated visitors
  // back to "/" — pairing that with a "/" -> "/dashboard" redirect creates an
  // infinite loop for every logged-out visitor (confirmed: curl hit its
  // max-redirects cap). "/" is the real marketing/landing page now that an
  // auth gate exists; logged-in users still land on /dashboard normally via
  // the login flow's own redirect.
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;

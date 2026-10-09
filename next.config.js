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
    // Turbopack's on-disk cache for `next build`, off. Vercel restores .next from the previous
    // deployment; on 8 Oct 2026 a build that restored it compiled in 4.5 s and shipped the
    // stylesheet of 5 Oct, although globals.css had changed in that commit (the new HTML and
    // the new manifest were live beside the old CSS chunk, under its old name). A full compile
    // is about 20 s. scripts/tests/theme-palette.test.mjs holds this line.
    turbopackFileSystemCacheForBuild: false,
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

    // Kompas (public/kompas, see scripts/sync-kompas.mjs) hears the call through the microphone and
    // the shared tab's audio, and loads its fonts, DOCX/PDF readers and offline speech model from
    // CDNs. Only its paths get those allowances; every other page keeps the policy above. These
    // entries come after the global one so their values win for the same header keys.
    const kompasHeaders = [
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), display-capture=(self), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' https://fonts.gstatic.com",
          "connect-src 'self' https://cdn.jsdelivr.net https://ccoreilly.github.io",
          "worker-src 'self' blob: https://cdn.jsdelivr.net",
          "media-src 'self' blob:",
          // Uploaded PDF previews are rendered in a local blob iframe.
          "frame-src 'self' blob:",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];

    // Kompas Flow and Kompas Transcribe (src/app/dashboard/kompas/flow, .../transcribe) are ordinary MarketFit pages that
    // listen through the microphone and play a recording back. They get the microphone and blob media, and nothing else:
    // no tab or screen capture, which only the copilot above is given.
    const speechHeaders = [
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
          "img-src 'self' data: blob: https: http:",
          "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "media-src 'self' blob:",
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
      { source: "/dashboard/kompas", headers: kompasHeaders },
      { source: "/kompas/:path*", headers: kompasHeaders },
      { source: "/dashboard/kompas/:page(flow|transcribe)", headers: speechHeaders },
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
    return [
      // Transcribe is part of the Kompas Flow page since 8 Oct 2026. Sent on here, as a real redirect, so the browser
      // loads the Flow page as its own document (with the microphone header) and a bookmark is not a dead end.
      // src/app/dashboard/kompas/transcribe/page.tsx is the net under this line.
      { source: "/dashboard/kompas/transcribe", destination: "/dashboard/kompas/flow?mode=transcribe", permanent: false },
    ];
  },

  // Kompas is served from MarketFit's own origin so the microphone belongs to this site. Its engine
  // stays with the copilot deployment: /kompas/api/<name> is forwarded to <origin>/api/<name>.
  // The default is the live copilot, perfact-ten; its frontend must match public/kompas (re-run
  // scripts/sync-kompas.mjs when it is redeployed). KOMPAS_API_ORIGIN points at another deployment.
  async rewrites() {
    const kompasApi = (process.env.KOMPAS_API_ORIGIN || "https://perfact-ten.vercel.app").replace(/\/+$/, "");
    return {
      beforeFiles: [
        { source: "/dashboard/kompas", destination: "/api/kompas/shell" },
        { source: "/kompas/index.html", destination: "/api/kompas/shell" },
        { source: "/kompas", destination: "/api/kompas/shell" },
        // The HTML is mounted locally, while every dependency and API uses the same live release.
        // Run before public/ so historical snapshots can never shadow the canonical deployment.
        { source: "/kompas/:path+", destination: `${kompasApi}/:path+` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;

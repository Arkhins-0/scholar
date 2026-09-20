/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Browser uploads PUT files straight to the S3-compatible bucket via a presigned
// URL (see lib/storage.ts), so the storage origin must be allowed in connect-src.
let storageOrigin = null;
try {
  storageOrigin = process.env.AWS_ENDPOINT_URL_S3 ? new URL(process.env.AWS_ENDPOINT_URL_S3).origin : null;
} catch {}

// Content-Security-Policy. Next injects inline hydration scripts and Tailwind
// emits inline styles, so 'unsafe-inline' is required for those; dev also needs
// 'unsafe-eval' for the webpack HMR runtime.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;

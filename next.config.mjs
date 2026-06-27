/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  // NOTE: no `output: "standalone"`. One Docker image serves both the web
  // (`next start`) and the worker (`tsx src/worker`), so the runtime keeps the
  // full node_modules + src. Standalone strips those and breaks the worker, and
  // `next start` doesn't run the standalone server (healthcheck never comes up).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

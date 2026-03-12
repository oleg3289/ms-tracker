import type { NextConfig } from "next";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Take over immediately without waiting for all tabs to close.
    // This ensures the fixed SW (with NetworkOnly for /api/*) activates
    // as soon as the new version is detected instead of waiting indefinitely.
    skipWaiting: true,
    clientsClaim: true,
    // Always go to the network for API routes — never let the SW cache or
    // intercept them. Without this, POST requests (e.g. /api/parse-pdf) can
    // silently fail on mobile PWA because Workbox tries to handle them.
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/,
        handler: 'NetworkOnly' as const,
        method: 'POST' as const,
      },
      {
        urlPattern: /^\/api\/.*/,
        handler: 'NetworkOnly' as const,
        method: 'GET' as const,
      },
    ],
  },
});
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  serverExternalPackages: ["pdf-parse"],
};
module.exports = withPWA(nextConfig);

import type { NextConfig } from "next";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
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

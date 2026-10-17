import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dev-only. Next blocks /_next/* (incl. the HMR WebSocket) when the page is
  // opened from a host it does not know about. The preview may reach us via
  // 127.0.0.1, the VM/LAN IP, a Docker bridge IP or a Cursor preview proxy.
  // Patterns are matched per DNS label, so "*.*.*.*" is "any dotted IPv4".
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.*.*.*",
    "**.localhost",
    "**.cursor.sh",
    "**.cursor.com",
    "**.cursor.so",
  ],
  experimental: {
    // Keep React's dev debug info inline in the RSC payload instead of
    // streaming it over the HMR WebSocket. With the default (true), a blocked
    // or proxied WebSocket leaves the Flight stream unfinished and the page
    // never hydrates: every button and the textarea stay dead.
    reactDebugChannel: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

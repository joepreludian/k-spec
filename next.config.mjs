import { allowedDevOrigins } from "./src/infrastructure/access/dev-origins.js";
import { resolveToken } from "./src/infrastructure/access/token.js";

// One access token per server process. Read from K_SPEC_TOKEN, else generated
// here so the proxy and the startup banner (src/instrumentation.js) agree.
resolveToken();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Browsers reaching the dev server through K_SPEC_HOST must be allow-listed, or Next
  // rejects their HMR websocket and the page never hydrates (clicks do nothing).
  allowedDevOrigins: allowedDevOrigins(process.env),
  // Native module: must be required at runtime, not bundled.
  serverExternalPackages: ["better-sqlite3"],
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

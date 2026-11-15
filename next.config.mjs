import { resolveToken } from "./src/infrastructure/access/token.js";

// One access token per server process. Read from K_SPEC_TOKEN, else generated
// here so the proxy and the startup banner (src/instrumentation.js) agree.
resolveToken();

/** @type {import('next').NextConfig} */
const nextConfig = {
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

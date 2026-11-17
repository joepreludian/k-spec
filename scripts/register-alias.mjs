// Lets plain `node` resolve the `@/…` import alias (→ src/…) that Next and Vitest configure.
// Usage: node --import ./scripts/register-alias.mjs <script>
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = fileURLToPath(new URL("../src/", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(src + specifier.slice(2)).href, context);
    }
    return nextResolve(specifier, context);
  },
});

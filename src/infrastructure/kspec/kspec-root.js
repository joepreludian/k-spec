import path from "node:path";

/** The folder the board is read from. Later the Docker slice mounts it at `/kspec-root`. */
export function kspecRoot() {
  return process.env.K_SPEC_ROOT || path.join(process.cwd(), "kspec-root");
}

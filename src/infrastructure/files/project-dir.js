/** Directory the markdown viewer reads from. Later the Docker slice mounts the project here. */
export function projectDir() {
  return process.env.K_SPEC_PROJECT_DIR || process.cwd();
}

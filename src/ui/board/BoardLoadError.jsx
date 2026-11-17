import { TriangleAlert } from "lucide-react";

const FileName = ({ file }) =>
  file ? <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{file}</code> : null;

/** Full page: the board could not be read at all. Keeps retrying in the background. */
export function BoardLoadError({ error }) {
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      <div role="alert" className="flex max-w-lg flex-col items-center gap-3 text-center">
        <TriangleAlert aria-hidden="true" className="size-8 text-destructive" />
        <h1 className="text-lg font-semibold">The board could not be loaded</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <FileName file={error.file} />
        <p className="text-xs text-muted-foreground">It will load by itself once this is fixed.</p>
      </div>
    </main>
  );
}

/** One line above the lanes: the files changed but the new state could not be read. */
export function BoardStaleNotice({ error }) {
  return (
    <div
      role="status"
      aria-label="Board not refreshed"
      className="flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm"
    >
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>Showing the last board that loaded. The files changed but could not be read: {error.message}</span>
      <FileName file={error.file} />
    </div>
  );
}

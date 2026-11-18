import { TriangleAlert } from "lucide-react";

/** Full page: the board could not be loaded at all. Keeps retrying in the background. */
export function BoardLoadError({ error }) {
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      <div role="alert" className="flex max-w-lg flex-col items-center gap-3 text-center">
        <TriangleAlert aria-hidden="true" className="size-8 text-destructive" />
        <h1 className="text-lg font-semibold">The board could not be loaded</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <p className="text-xs text-muted-foreground">It will load by itself once the server answers.</p>
      </div>
    </main>
  );
}

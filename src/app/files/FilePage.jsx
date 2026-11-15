"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FileView } from "@/ui/shared/FileView.jsx";

export function FilePage({ path }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to board
      </Link>
      <h1 className="font-mono text-base font-semibold">{path}</h1>
      <FileView path={path} />
    </main>
  );
}

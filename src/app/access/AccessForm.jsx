"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccessForm({ error }) {
  const [token, setToken] = useState("");

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = token.trim();
        if (!clean) return;
        // A full navigation on purpose: the proxy must see the token query to
        // set the cookie before any page or RSC request is served.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/?token=${encodeURIComponent(clean)}`);
      }}
    >
      <div className="flex items-center gap-2">
        <KeyRound aria-hidden="true" className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">k-spec</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        This board is private. Paste the access token from the server console, or open the link it printed.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="access-token" className="text-sm font-medium">
          Access token
        </label>
        <Input
          id="access-token"
          type="password"
          autoComplete="off"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          That token didn’t work. Check the server console and try again.
        </p>
      )}
      <Button type="submit">Open board</Button>
    </form>
  );
}

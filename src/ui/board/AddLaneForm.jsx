"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoard } from "@/ui/store/use-board.js";

export function AddLaneForm() {
  const { dispatch } = useBoard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const close = () => {
    setOpen(false);
    setName("");
  };
  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    const result = await dispatch("createLane", { name: clean });
    if (result) close();
  };

  if (!open) {
    return (
      <Button variant="outline" className="w-72 shrink-0 justify-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" data-icon="inline-start" />+ Lane
      </Button>
    );
  }

  return (
    <form
      className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        autoFocus
        aria-label="Lane name"
        placeholder="Lane name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Add lane
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

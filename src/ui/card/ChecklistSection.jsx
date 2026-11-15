"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoard } from "@/ui/store/use-board.js";
import { Checklist } from "./Checklist.jsx";

export function ChecklistSection({ card }) {
  const { dispatch } = useBoard();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const close = () => {
    setAdding(false);
    setTitle("");
  };
  const submit = async () => {
    const clean = title.trim();
    if (!clean) return;
    const result = await dispatch("addChecklist", { cardId: card.id, title: clean });
    if (result) close();
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Checklists</h3>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" data-icon="inline-start" />+ Checklist
          </Button>
        )}
      </div>
      {card.checklists.map((checklist) => (
        <Checklist key={checklist.id} card={card} checklist={checklist} />
      ))}
      {adding && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            aria-label="Checklist title"
            placeholder="Checklist title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="h-8"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </form>
      )}
    </section>
  );
}

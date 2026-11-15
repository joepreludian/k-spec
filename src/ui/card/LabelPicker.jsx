"use client";

import { useState } from "react";
import { Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { LabelChip } from "@/ui/shared/LabelChip.jsx";
import { useBoard } from "@/ui/store/use-board.js";
import { ColorSwatches } from "./ColorSwatches.jsx";

/**
 * Popover listing the board's labels (toggle on/off for this card), with
 * inline edit/delete of existing labels and a create form.
 */
export function LabelPicker({ card }) {
  const { board, dispatch } = useBoard();
  const [editingId, setEditingId] = useState(null);

  const toggle = (label, checked) =>
    dispatch(checked ? "addLabel" : "removeLabel", { cardId: card.id, labelId: label.id });

  return (
    <Popover onOpenChange={(open) => !open && setEditingId(null)}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Edit labels">
          <Tag aria-hidden="true" data-icon="inline-start" />
          Labels
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Labels" align="start" className="w-72 p-3">
        <ul className="flex flex-col gap-1">
          {board.labels.map((label) =>
            editingId === label.id ? (
              <li key={label.id}>
                <LabelForm
                  key={label.id}
                  initial={label}
                  submitText="Save"
                  nameLabel="Label name"
                  onSubmit={({ name, color }) => {
                    dispatch("updateLabel", { labelId: label.id, name, color });
                    setEditingId(null);
                  }}
                  onDelete={() => {
                    dispatch("deleteLabel", { labelId: label.id });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={label.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/60">
                <Checkbox
                  id={`label-toggle-${label.id}`}
                  aria-label={label.name}
                  checked={card.labelIds.includes(label.id)}
                  onCheckedChange={(checked) => toggle(label, checked === true)}
                />
                <label htmlFor={`label-toggle-${label.id}`} className="flex-1 cursor-pointer">
                  <LabelChip label={label} />
                </label>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit label ${label.name}`}
                  onClick={() => setEditingId(label.id)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </li>
            ),
          )}
        </ul>
        {editingId === null && (
          <>
            {board.labels.length > 0 && <Separator className="my-3" />}
            <LabelForm
              initial={{ name: "", color: "gray" }}
              submitText="Create label"
              nameLabel="New label name"
              resetOnSubmit
              onSubmit={async ({ name, color }) => {
                const created = await dispatch("createLabel", { name, color });
                if (created?.id) await dispatch("addLabel", { cardId: card.id, labelId: created.id });
              }}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LabelForm({ initial, submitText, nameLabel, onSubmit, onDelete, onCancel, resetOnSubmit = false }) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);

  return (
    <form
      className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const clean = name.trim();
        if (!clean) return;
        await onSubmit({ name: clean, color });
        if (resetOnSubmit) {
          setName("");
          setColor("gray");
        }
      }}
    >
      <Input
        aria-label={nameLabel}
        placeholder={nameLabel}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8"
      />
      <ColorSwatches value={color} onChange={setColor} />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {submitText}
        </Button>
        {onDelete && (
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        )}
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

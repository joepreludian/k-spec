"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Click-to-edit text. Enter submits the trimmed value when it changed;
 * Escape or blur cancels. `editing`/`onEditingChange` make it controlled.
 */
export function InlineEdit({
  value,
  onSubmit,
  as: Tag = "span",
  inputLabel,
  className,
  inputClassName,
  editing: controlledEditing,
  onEditingChange,
  ...rest
}) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = controlledEditing ?? internalEditing;
  const setEditing = (next) => {
    setInternalEditing(next);
    onEditingChange?.(next);
  };

  if (!editing) {
    return (
      <Tag
        {...rest}
        className={cn("cursor-text rounded px-1 -mx-1 hover:bg-muted/60", className)}
        onClick={() => setEditing(true)}
      >
        {value}
      </Tag>
    );
  }

  // Mounted only while editing, so its draft state resets on every edit session.
  return (
    <EditInput
      initialValue={value}
      inputLabel={inputLabel}
      className={inputClassName}
      onCancel={() => setEditing(false)}
      onSubmit={(next) => {
        setEditing(false);
        if (next.length > 0 && next !== value) onSubmit(next);
      }}
    />
  );
}

function EditInput({ initialValue, inputLabel, className, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <Input
      autoFocus
      onFocus={(e) => e.target.select()}
      aria-label={inputLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(draft.trim());
        if (e.key === "Escape") onCancel();
      }}
      className={cn("h-7 text-sm", className)}
    />
  );
}

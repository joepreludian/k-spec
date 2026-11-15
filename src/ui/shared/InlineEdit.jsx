"use client";

import { useEffect, useRef, useState } from "react";
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
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

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

  const submit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next.length > 0 && next !== value) onSubmit(next);
  };

  return (
    <Input
      ref={inputRef}
      aria-label={inputLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") setEditing(false);
      }}
      className={cn("h-7 text-sm", inputClassName)}
    />
  );
}

"use client";

import { Check } from "lucide-react";
import { LABEL_COLORS } from "@/domain/label-colors.js";
import { LABEL_SWATCH_CLASSES } from "@/ui/shared/label-colors.js";
import { cn } from "@/lib/utils";

/** Radio-group of color swatches. */
export function ColorSwatches({ value, onChange, name = "Label color" }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-label={color}
          aria-checked={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full ring-offset-background transition-shadow",
            LABEL_SWATCH_CLASSES[color],
            value === color && "ring-2 ring-ring ring-offset-2",
          )}
        >
          {value === color && <Check aria-hidden="true" className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

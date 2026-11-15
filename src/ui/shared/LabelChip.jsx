import { cn } from "@/lib/utils";
import { LABEL_COLOR_CLASSES } from "./label-colors.js";

export function LabelChip({ label, className }) {
  return (
    <span
      data-label-id={label.id}
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium leading-none",
        LABEL_COLOR_CLASSES[label.color] ?? LABEL_COLOR_CLASSES.gray,
        className,
      )}
    >
      {label.name}
    </span>
  );
}

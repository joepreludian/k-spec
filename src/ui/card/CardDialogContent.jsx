"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Dialog content without the primitive's zoom/slide entrance: the card appears in place over
 * the dimmed board (user decision: no opening animation). Same chrome as shadcn's DialogContent.
 */
export function CardDialogContent({ className, children, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close data-slot="dialog-close" asChild>
          <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

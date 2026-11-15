"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findCard } from "@/domain/board.js";
import { useBoard } from "@/ui/store/use-board.js";

/** Placeholder until the full card detail lands; shows the title in a dialog. */
export function CardDialog({ cardId, onClose }) {
  const { board } = useBoard();
  const found = cardId ? findCard(board, cardId) : null;
  return (
    <Dialog open={Boolean(found)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{found?.card.title}</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

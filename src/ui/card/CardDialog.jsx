"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { findCard } from "@/domain/board.js";
import { InlineEdit } from "@/ui/shared/InlineEdit.jsx";
import { LabelChip } from "@/ui/shared/LabelChip.jsx";
import { useBoard } from "@/ui/store/use-board.js";
import { AgentStatusSelect } from "./AgentStatusSelect.jsx";
import { ChecklistSection } from "./ChecklistSection.jsx";
import { CommentsSection } from "./CommentsSection.jsx";
import { DeleteCardButton } from "./DeleteCardButton.jsx";
import { DescriptionEditor } from "./DescriptionEditor.jsx";
import { LabelPicker } from "./LabelPicker.jsx";

export function CardDialog({ cardId, onClose }) {
  const { board, dispatch } = useBoard();
  const found = cardId ? findCard(board, cardId) : null;

  return (
    <Dialog open={Boolean(found)} onOpenChange={(open) => !open && onClose()}>
      {found && (
        <DialogContent className="flex max-h-[88vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="text-left">
            <InlineEdit
              as={DialogTitle}
              value={found.card.title}
              inputLabel="Card title"
              onSubmit={(title) => dispatch("updateCardTitle", { cardId: found.card.id, title })}
              className="text-lg font-semibold leading-tight"
              inputClassName="h-9 text-lg font-semibold"
            />
            <DialogDescription>in {found.lane.name}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusSelect card={found.card} />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex flex-wrap items-center gap-1.5">
              {found.card.labelIds
                .map((id) => board.labels.find((l) => l.id === id))
                .filter(Boolean)
                .map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
              <LabelPicker card={found.card} />
            </div>
          </div>

          <DescriptionEditor card={found.card} />
          <ChecklistSection card={found.card} />
          <CommentsSection card={found.card} />

          <DialogFooter className="mt-2 flex-row justify-between border-t pt-3 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Updated {new Date(found.card.updatedAt).toLocaleString()}
            </span>
            <DeleteCardButton card={found.card} onDeleted={onClose} />
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

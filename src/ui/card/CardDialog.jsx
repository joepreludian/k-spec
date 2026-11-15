"use client";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findCard } from "@/domain/board.js";
import { InlineEdit } from "@/ui/shared/InlineEdit.jsx";
import { LabelChip } from "@/ui/shared/LabelChip.jsx";
import { WhereLine } from "@/ui/shared/WhereLine.jsx";
import { relativeTime } from "@/ui/shared/relative-time.js";
import { useBoard } from "@/ui/store/use-board.js";
import { AgentStatusSelect } from "./AgentStatusSelect.jsx";
import { CardDialogContent } from "./CardDialogContent.jsx";
import { DeleteCardButton } from "./DeleteCardButton.jsx";
import { LabelPicker } from "./LabelPicker.jsx";
import { OverviewTab } from "./OverviewTab.jsx";
import { SpecTab } from "./SpecTab.jsx";

const Count = ({ n }) =>
  n > 0 ? (
    <>
      {" "}
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{n}</span>
    </>
  ) : null;

export function CardDialog({ cardId, onClose }) {
  const { board, dispatch } = useBoard();
  const found = cardId ? findCard(board, cardId) : null;
  const card = found?.card;

  return (
    <Dialog open={Boolean(found)} onOpenChange={(open) => !open && onClose()}>
      {found && (
        <CardDialogContent className="h-[85vh] gap-3 sm:max-w-3xl">
          <DialogHeader className="text-left">
            <div className="flex items-baseline gap-2 pr-8">
              <span className="text-lg font-medium text-muted-foreground">#{card.number}</span>
              <InlineEdit
                as={DialogTitle}
                value={card.title}
                inputLabel="Card title"
                onSubmit={(title) => dispatch("updateCardTitle", { cardId: card.id, title })}
                className="text-lg font-semibold leading-tight"
                inputClassName="h-9 text-lg font-semibold"
              />
            </div>
            <DialogDescription>
              {`In ${found.lane.name} · created ${relativeTime(card.createdAt)} · updated ${relativeTime(card.updatedAt)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusSelect card={card} />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex flex-wrap items-center gap-1.5">
              {card.labelIds
                .map((id) => board.labels.find((l) => l.id === id))
                .filter(Boolean)
                .map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
              <LabelPicker card={card} />
            </div>
            <WhereLine work={card.work} className="ml-auto rounded-md border px-2 py-1" />
          </div>

          <Tabs key={card.id} defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-3">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="spec">
                Spec
                <Count n={card.links.length} />
              </TabsTrigger>
              <TabsTrigger value="execution">Execution</TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                <Count n={card.comments.length + card.events.length} />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <OverviewTab card={card} />
            </TabsContent>
            <TabsContent value="spec" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <SpecTab card={card} />
            </TabsContent>
            <TabsContent value="execution" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">Coming next</p>
            </TabsContent>
            <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">Coming next</p>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-row justify-between border-t pt-3 sm:justify-between">
            <span className="text-xs text-muted-foreground">Updated {new Date(card.updatedAt).toLocaleString()}</span>
            <DeleteCardButton card={card} onDeleted={onClose} />
          </DialogFooter>
        </CardDialogContent>
      )}
    </Dialog>
  );
}

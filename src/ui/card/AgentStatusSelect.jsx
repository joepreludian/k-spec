"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGENT_STATUSES } from "@/domain/agent-status.js";
import { AGENT_STATUS_DOT_CLASSES } from "@/ui/shared/AgentStatusBadge.jsx";
import { cn } from "@/lib/utils";
import { useBoard } from "@/ui/store/use-board.js";

export const AGENT_STATUS_LABELS = Object.freeze({
  idle: "Idle",
  working: "Working",
  "waiting-for-input": "Waiting for input",
  blocked: "Blocked",
});

export function AgentStatusSelect({ card }) {
  const { dispatch } = useBoard();
  return (
    <Select value={card.agentStatus} onValueChange={(status) => dispatch("setAgentStatus", { cardId: card.id, status })}>
      <SelectTrigger aria-label="Agent status" size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AGENT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-2 rounded-full", AGENT_STATUS_DOT_CLASSES[status])} />
              {AGENT_STATUS_LABELS[status]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

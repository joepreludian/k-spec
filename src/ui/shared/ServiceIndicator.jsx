"use client";

import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServiceStatuses } from "./use-service-status.js";

/** A globe for a card with published services: green when at least one answers. Nothing without services. */
export function ServiceIndicator({ services, className }) {
  const statuses = useServiceStatuses(services.map((s) => s.url));
  if (services.length === 0) return null;

  const online = statuses.filter((s) => s === "online").length;
  const state = online > 0 ? `${online} online` : statuses.includes("checking") ? "checking" : "offline";
  const label = `${services.length} ${services.length === 1 ? "service" : "services"}, ${state}`;

  return (
    <span
      aria-label={label}
      title={label}
      data-online={online > 0}
      className={cn("flex items-center gap-1", online > 0 && "text-emerald-600 dark:text-emerald-400", className)}
    >
      <Globe aria-hidden="true" className="size-3.5" />
      {services.length > 1 && services.length}
    </span>
  );
}

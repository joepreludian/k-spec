"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServiceStatus } from "./use-service-status.js";

/** Checks one service and reports its status up; renders nothing. */
function ServiceProbe({ service, onStatus }) {
  const status = useServiceStatus(service.url);
  useEffect(() => onStatus(service.id, status), [service.id, status, onStatus]);
  return null;
}

/** A globe for a card with published services: green when at least one answers. Nothing without services. */
export function ServiceIndicator({ services, className }) {
  const [statuses, setStatuses] = useState({});
  const report = useCallback(
    (id, status) => setStatuses((prev) => (prev[id] === status ? prev : { ...prev, [id]: status })),
    [],
  );
  if (services.length === 0) return null;

  const known = services.map((s) => statuses[s.id] ?? "checking");
  const online = known.filter((s) => s === "online").length;
  const state = online > 0 ? `${online} online` : known.includes("checking") ? "checking" : "offline";
  const label = `${services.length} ${services.length === 1 ? "service" : "services"}, ${state}`;

  return (
    <span
      aria-label={label}
      title={label}
      data-online={online > 0}
      className={cn("flex items-center gap-1", online > 0 && "text-emerald-600 dark:text-emerald-400", className)}
    >
      {services.map((service) => (
        <ServiceProbe key={service.id} service={service} onStatus={report} />
      ))}
      <Globe aria-hidden="true" className="size-3.5" />
      {services.length > 1 && services.length}
    </span>
  );
}

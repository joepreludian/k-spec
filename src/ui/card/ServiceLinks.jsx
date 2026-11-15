"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceStatus } from "@/ui/shared/use-service-status.js";
import { cn } from "@/lib/utils";

function ServiceLink({ service }) {
  const status = useServiceStatus(service.url);
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={service.url}
        target="_blank"
        rel="noreferrer noopener"
        title={service.url}
        aria-label={`${service.title}, ${status}`}
      >
        <span
          aria-hidden="true"
          className={cn("size-2 rounded-full", status === "online" ? "bg-emerald-500" : "bg-muted-foreground/40")}
        />
        <span className="font-mono text-xs">{service.title}</span>
        <ExternalLink aria-hidden="true" data-icon="inline-end" />
      </a>
    </Button>
  );
}

/** Services published on the card's active work, as new-tab buttons with a live dot. Nothing without services. */
export function ServiceLinks({ card }) {
  const services = card.work?.services ?? [];
  if (services.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services</h3>
      <div className="flex flex-wrap gap-2">
        {services.map((service) => (
          <ServiceLink key={service.id} service={service} />
        ))}
      </div>
    </section>
  );
}

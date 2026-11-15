"use client";

import { ChecklistSection } from "./ChecklistSection.jsx";
import { ChecklistSummary } from "./ChecklistSummary.jsx";
import { DescriptionEditor } from "./DescriptionEditor.jsx";
import { ExecutionSummary } from "./ExecutionSummary.jsx";
import { ServiceLinks } from "./ServiceLinks.jsx";

export function OverviewTab({ card }) {
  return (
    <div className="flex flex-col gap-5">
      <ServiceLinks card={card} />
      <ExecutionSummary card={card} />
      <DescriptionEditor card={card} />
      <section className="flex flex-col gap-3">
        <ChecklistSummary card={card} />
        <ChecklistSection card={card} />
      </section>
    </div>
  );
}

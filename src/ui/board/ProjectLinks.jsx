import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Outline buttons for the project's external links; each opens in a new tab. */
export function ProjectLinks({ links }) {
  if (!links?.length) return null;
  return (
    <>
      {links.map((link) => (
        <Button key={link.id} asChild variant="outline" size="sm">
          <a href={link.url} target="_blank" rel="noreferrer noopener">
            {link.title}
            <ExternalLink aria-hidden="true" data-icon="inline-end" />
          </a>
        </Button>
      ))}
    </>
  );
}

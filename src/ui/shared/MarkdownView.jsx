"use client";

import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { rewriteMarkdownHref } from "./markdown-links.js";

const PROSE =
  "text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_table]:my-2 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:px-2 [&_td]:py-1";

/**
 * Renders markdown. With `basePath` (the file being viewed), relative `.md` links are
 * rewritten to the in-app file page; external links open in a new tab. `newTab` makes the
 * internal links open in a new tab too: on the board the state lives in this tab only, so a
 * same-tab navigation from the README sheet or the Spec tab would throw the board away.
 */
export function MarkdownView({ children, basePath, newTab = false, className }) {
  const components = {
    a: ({ href, children: linkChildren, node: _node, ...rest }) => {
      const link = rewriteMarkdownHref(href, basePath);
      if (link.kind === "plain") return <span {...rest}>{linkChildren}</span>;
      if (link.kind === "external") {
        return (
          <a href={link.href} target="_blank" rel="noreferrer noopener" {...rest}>
            {linkChildren}
          </a>
        );
      }
      const blank = newTab && link.kind === "internal" ? { target: "_blank", rel: "noreferrer noopener" } : {};
      return (
        <a href={link.href} {...blank} {...rest}>
          {linkChildren}
        </a>
      );
    },
  };
  return (
    <div className={cn(PROSE, className)}>
      <Markdown components={components}>{children}</Markdown>
    </div>
  );
}

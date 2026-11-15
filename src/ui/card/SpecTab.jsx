"use client";

import { useState } from "react";
import { SpecDocument } from "./SpecDocument.jsx";
import { SpecFileGrid } from "./SpecFileGrid.jsx";

/** Linked markdown files as an icon grid; opening one shows it across the whole tab. */
export function SpecTab({ card }) {
  const [openId, setOpenId] = useState(null);
  // The tile to hand keyboard focus back to when the document closes.
  const [returnId, setReturnId] = useState(null);
  const open = card.links.find((l) => l.id === openId) ?? null;

  return open ? (
    <SpecDocument
      link={open}
      onBack={() => {
        setReturnId(open.id);
        setOpenId(null);
      }}
    />
  ) : (
    <SpecFileGrid card={card} onOpen={setOpenId} focusId={returnId} />
  );
}

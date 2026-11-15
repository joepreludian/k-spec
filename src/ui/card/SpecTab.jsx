"use client";

import { useState } from "react";
import { SpecDocument } from "./SpecDocument.jsx";
import { SpecFileGrid } from "./SpecFileGrid.jsx";

/** Linked markdown files as an icon grid; opening one shows it across the whole tab. */
export function SpecTab({ card }) {
  const [openId, setOpenId] = useState(null);
  const open = card.links.find((l) => l.id === openId) ?? null;

  return open ? (
    <SpecDocument link={open} onBack={() => setOpenId(null)} />
  ) : (
    <SpecFileGrid card={card} onOpen={setOpenId} />
  );
}

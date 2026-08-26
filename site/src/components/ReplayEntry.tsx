"use client";

import { useExperience } from "@/lib/experience";

/** Lets anyone walk back through the door they were let through once. */
export function ReplayEntry({ className }: { className?: string }) {
  const { replay } = useExperience();
  return (
    <button type="button" className={className} onClick={replay}>
      Replay the entry
    </button>
  );
}

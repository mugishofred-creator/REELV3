"use client";

import type { ReactNode } from "react";
import { useExperience } from "@/lib/experience";

/** While the veil is up, the page beneath it is not reachable by keyboard. */
export function MainRegion({ children }: { children: ReactNode }) {
  const { isVeiled } = useExperience();
  return (
    <main id="content" tabIndex={-1} inert={isVeiled}>
      {children}
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "@/lib/experience";
import { Sigil, Wordmark } from "./Wordmark";
import styles from "./Veil.module.css";

const CONSEQUENCE = {
  yes: "Then you are already one of us.",
  no: "It follows you anyway.",
} as const;

export function Veil() {
  const { stage, answer, isVeiled, respond, skip } = useExperience();
  const [mounted, setMounted] = useState(false);
  const firstChoice = useRef<HTMLButtonElement>(null);

  /* Hold the veil on screen for its fade-out, then take it out of the DOM. */
  useEffect(() => {
    if (isVeiled) setMounted(true);
    else if (mounted) {
      const timer = setTimeout(() => {
        setMounted(false);
        /* The door closes behind you: keyboard focus lands on the page itself. */
        document.getElementById("content")?.focus({ preventScroll: true });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isVeiled, mounted]);

  useEffect(() => {
    if (stage === "question") firstChoice.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (!isVeiled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVeiled, skip]);

  if (!mounted) return null;

  const shown = (...stages: string[]) => stages.includes(stage);

  return (
    <div
      className={[styles.veil, isVeiled ? "" : styles.leaving].filter(Boolean).join(" ")}
      data-answer={answer ?? undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Entering Lord Forgive Me"
    >
      <div className={styles.core}>
        <Sigil size={64} className={styles.sigil} />

        {shown("name", "carry", "question", "answered", "open") && (
          <p className={styles.name}>
            <Wordmark stacked />
          </p>
        )}

        <div className={styles.beat} aria-live="polite">
          {shown("carry") && <p className={`line ${styles.beatLine}`}>We all carry something.</p>}

          {shown("question") && (
            <>
              <p className={`line ${styles.beatLine} ${styles.question}`}>Do you carry yours?</p>
              <div className={styles.choices}>
                <button
                  ref={firstChoice}
                  type="button"
                  className={styles.choice}
                  onClick={() => respond("yes")}
                >
                  Yes
                </button>
                <span className={styles.divider} aria-hidden="true" />
                <button type="button" className={styles.choice} onClick={() => respond("no")}>
                  No
                </button>
              </div>
            </>
          )}

          {shown("answered") && answer && (
            <p className={`line ${styles.beatLine}`}>{CONSEQUENCE[answer]}</p>
          )}
        </div>
      </div>

      {stage !== "answered" && (
        <button type="button" className={styles.skip} onClick={skip}>
          Skip the entry
        </button>
      )}
    </div>
  );
}

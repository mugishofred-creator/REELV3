"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * The entry. Five beats, one question, one consequence.
 *
 *   mark → name → carry → question → answered → open
 *
 * Everything the visitor can see is server-rendered underneath; this only
 * governs the veil on top of it, so the site works with JS off and for crawlers.
 */
export type Stage = "boot" | "mark" | "name" | "carry" | "question" | "answered" | "open";
export type Answer = "yes" | "no";

const STORAGE_KEY = "lfm.entry.v1";

const BEATS: Partial<Record<Stage, number>> = {
  mark: 900,
  name: 1700,
  carry: 2000,
  answered: 2200,
};

const REDUCED: Partial<Record<Stage, number>> = {
  mark: 300,
  name: 500,
  carry: 600,
  answered: 700,
};

type ExperienceValue = {
  stage: Stage;
  answer: Answer | null;
  /** True while the veil is on screen. */
  isVeiled: boolean;
  respond: (answer: Answer) => void;
  skip: () => void;
  replay: () => void;
};

const ExperienceContext = createContext<ExperienceValue | null>(null);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("boot");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const advance = useCallback((from: Stage, to: Stage) => {
    const beats = prefersReducedMotion() ? REDUCED : BEATS;
    clear();
    timer.current = setTimeout(() => setStage(to), beats[from] ?? 1000);
  }, []);

  /* Returning visitors are not made to knock twice. */
  useEffect(() => {
    let remembered: { answer?: Answer } | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      remembered = raw ? (JSON.parse(raw) as { answer?: Answer }) : null;
    } catch {
      remembered = null;
    }
    if (remembered?.answer) {
      setAnswer(remembered.answer);
      setStage("open");
    } else {
      setStage("mark");
    }
    return clear;
  }, []);

  useEffect(() => {
    if (stage === "mark") advance("mark", "name");
    else if (stage === "name") advance("name", "carry");
    else if (stage === "carry") advance("carry", "question");
    else if (stage === "answered") advance("answered", "open");
  }, [stage, advance]);

  /* The answer changes the light of the whole site, not just this screen. */
  useEffect(() => {
    const { body } = document;
    if (answer) body.dataset.answer = answer;
    else delete body.dataset.answer;
  }, [answer]);

  const isVeiled = stage !== "boot" && stage !== "open";

  useEffect(() => {
    if (!isVeiled) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isVeiled]);

  const remember = (value: Answer) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ answer: value }));
    } catch {
      /* nothing to remember with — the entry simply plays again */
    }
  };

  const value = useMemo<ExperienceValue>(
    () => ({
      stage,
      answer,
      isVeiled,
      respond: (given) => {
        setAnswer(given);
        remember(given);
        setStage("answered");
      },
      skip: () => {
        clear();
        if (!answer) {
          setAnswer("yes");
          remember("yes");
        }
        setStage("open");
      },
      replay: () => {
        clear();
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setAnswer(null);
        setStage("mark");
      },
    }),
    [stage, answer, isVeiled],
  );

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceValue {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error("useExperience must be used inside <ExperienceProvider>");
  return value;
}

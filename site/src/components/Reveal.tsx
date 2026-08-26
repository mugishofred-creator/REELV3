"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger in milliseconds — keep it under 400 or it reads as a loading bug. */
  delay?: number;
  as?: ElementType;
  className?: string;
};

/**
 * Content arrives once, on first sight, then stays. No scroll-linked animation:
 * it costs frames on mobile and the brand does not need the noise.
 */
export function Reveal({ children, delay = 0, as: Tag = "div", className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return (
    <Tag
      ref={ref}
      className={["reveal", className].filter(Boolean).join(" ")}
      data-seen={seen ? "true" : "false"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

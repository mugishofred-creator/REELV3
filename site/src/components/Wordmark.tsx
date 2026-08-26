import Image from "next/image";
import styles from "./Wordmark.module.css";

type WordmarkProps = {
  /** "display" for the stage, "small" for navigation. */
  variant?: "display" | "small";
  /** Stack the three words. Reserved for the entry and the hero. */
  stacked?: boolean;
  className?: string;
};

export function Wordmark({ variant = "display", stacked = false, className }: WordmarkProps) {
  const classes = [
    "gothic",
    "chrome-text",
    styles.wordmark,
    variant === "small" ? styles.small : "",
    stacked ? styles.stacked : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!stacked) return <span className={classes}>Lord Forgive Me</span>;

  return (
    <span className={classes}>
      <span>Lord</span>
      <span>Forgive</span>
      <span>Me</span>
    </span>
  );
}

/** The gold LF sigil. Used once per screen, never twice. */
export function Sigil({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/lf-mark.webp"
      alt=""
      width={Math.round(size * 0.8)}
      height={size}
      className={[styles.sigil, className].filter(Boolean).join(" ")}
      style={{ ["--sigil-size" as string]: `${size}px` }}
      priority
    />
  );
}

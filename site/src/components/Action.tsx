import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./Action.module.css";

type Variant = "solid" | "ghost";

function classes(variant: Variant, inline?: boolean, extra?: string) {
  return [styles.action, variant === "ghost" ? styles.ghost : "", inline ? styles.inline : "", extra]
    .filter(Boolean)
    .join(" ");
}

export function ActionButton({
  children,
  variant = "solid",
  inline,
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; inline?: boolean; children: ReactNode }) {
  return (
    <button className={classes(variant, inline, className)} {...rest}>
      {children}
    </button>
  );
}

export function ActionLink({
  children,
  variant = "solid",
  inline,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; inline?: boolean; children: ReactNode }) {
  return (
    <Link className={classes(variant, inline, className)} {...rest}>
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useExperience } from "@/lib/experience";
import { Sigil, Wordmark } from "./Wordmark";
import styles from "./Header.module.css";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/world", label: "World" },
];

export function Header() {
  const { isVeiled } = useExperience();
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className={[styles.header, isVeiled ? styles.hidden : ""].join(" ")}>
      <Link href="/" className={styles.home} aria-label="Lord Forgive Me — home">
        <Sigil size={22} />
        <Wordmark variant="small" className={styles.wordmark} />
      </Link>

      <nav className={styles.nav} aria-label="Main">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
        <button type="button" className={styles.link} onClick={open}>
          Cart<span className={styles.count}>{count > 0 ? ` (${count})` : ""}</span>
        </button>
      </nav>
    </header>
  );
}

import Link from "next/link";
import { site } from "@/lib/site";
import { ReplayEntry } from "./ReplayEntry";
import { Sigil } from "./Wordmark";
import styles from "./Footer.module.css";

const COLLECTIONS = [
  { href: "/sins", label: "Sins" },
  { href: "/cloud", label: "Cloud" },
  { href: "/shop", label: "Drop 001" },
];

const HOUSE = [
  { href: "/world", label: "The world" },
  { href: site.instagram, label: "Instagram", external: true },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <Sigil size={30} />
        <p className={styles.statement}>
          Lord Forgive Me
          <br />
          We wear our sins.
        </p>
      </div>

      <nav className={styles.column} aria-label="Collections">
        <h2 className={styles.heading}>Collections</h2>
        {COLLECTIONS.map((item) => (
          <Link key={item.href} href={item.href} className={styles.link}>
            {item.label}
          </Link>
        ))}
      </nav>

      <nav className={styles.column} aria-label="House">
        <h2 className={styles.heading}>House</h2>
        {HOUSE.map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              className={styles.link}
              rel="noreferrer noopener"
              target="_blank"
            >
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={styles.link}>
              {item.label}
            </Link>
          ),
        )}
        <ReplayEntry className={styles.link} />
      </nav>

      <div className={styles.legal}>
        <span>&copy; {new Date().getFullYear()} Lord Forgive Me</span>
        <span>{site.drop} — Sins &amp; Cloud</span>
      </div>
    </footer>
  );
}

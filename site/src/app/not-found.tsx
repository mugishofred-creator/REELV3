import { ActionLink } from "@/components/Action";
import { Star } from "@/components/Star";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <Star size={12} />
      <h1 className={`gothic chrome-text ${styles.title}`}>Nothing here to carry.</h1>
      <p className="label">This page is not part of the story.</p>
      <ActionLink href="/" variant="ghost" inline>
        Back to the beginning
      </ActionLink>
    </div>
  );
}

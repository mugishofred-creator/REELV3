import { ActionLink } from "./Action";
import { Artwork } from "./Artwork";
import { Reveal } from "./Reveal";
import { Star } from "./Star";
import type { Collection } from "@/lib/products";
import styles from "./CollectionPortal.module.css";

/** Artwork scale per collection, so neither half shouts over the other. */
const ART_WIDTH: Record<string, string> = { sins: "100%", cloud: "58%" };

export function CollectionPortal({
  collection,
  flipped = false,
}: {
  collection: Collection;
  flipped?: boolean;
}) {
  return (
    <div
      className={[styles.portal, flipped ? styles.flipped : ""].filter(Boolean).join(" ")}
      style={{ ["--portal-art" as string]: ART_WIDTH[collection.id] ?? "80%" }}
    >
      <Reveal className={styles.art}>
        <Artwork
          name={collection.artwork}
          sizes="(min-width: 56rem) 45vw, 90vw"
          className={styles.artImage}
        />
      </Reveal>

      <Reveal className={styles.copy} delay={120}>
        <p className={styles.index}>
          <Star size={9} />
          Chapter {collection.index}
        </p>
        <p className={styles.prompt}>{collection.prompt}</p>
        <h2 className={`gothic chrome-text ${styles.title}`}>{collection.title}</h2>
        <p className={styles.line}>{collection.line}</p>
        <ActionLink
          href={`/${collection.id}`}
          variant="ghost"
          inline
          className={styles.enter}
        >
          Enter {collection.title}
        </ActionLink>
      </Reveal>
    </div>
  );
}

export { ART_WIDTH as portalArtWidth };

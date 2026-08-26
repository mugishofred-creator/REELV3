import { ActionLink } from "@/components/Action";
import { Artwork } from "@/components/Artwork";
import { CollectionPortal } from "@/components/CollectionPortal";
import { ProductGrid } from "@/components/ProductGrid";
import { Reveal } from "@/components/Reveal";
import { Star } from "@/components/Star";
import { Wordmark } from "@/components/Wordmark";
import { collections, getFeatured } from "@/lib/products";
import { chapters, site } from "@/lib/site";
import styles from "./page.module.css";

export default function HomePage() {
  const featured = getFeatured(4);

  return (
    <>
      {/* The house, stated once. */}
      <section className={styles.hero}>
        <div className={styles.heroCore}>
          <p className={`label ${styles.drop}`}>
            <Star size={9} />
            {site.drop} — Sins &amp; Cloud
          </p>
          <Artwork
            name="crown"
            sizes="(min-width: 56rem) 24rem, 45vw"
            priority
            className={styles.crown}
          />
          <h1>
            <Wordmark stacked className={styles.wordmark} />
          </h1>
          <p className={`line ${styles.tagline}`}>We wear our sins.</p>
        </div>

        <p className={styles.cue} aria-hidden="true">
          <span className={styles.cueRule} />
          Keep going
        </p>
      </section>

      {/* The arc. Two chapters open, one sealed. */}
      <section className="shell chapter">
        <div className={styles.arc}>
          <Reveal>
            <p className={`line ${styles.arcLine}`}>
              The story runs in four chapters. Two of them are open.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <ul className={styles.chapters}>
              {chapters.map((chapter) => (
                <li key={chapter.id} className={styles.chapterMark} data-state={chapter.state}>
                  {chapter.title}
                  {chapter.state === "sealed" && <span className={styles.sealed}>Sealed</span>}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <hr className="rule" />

      {/* What we carry, then what we look toward. */}
      <section className="shell chapter">
        <div className={styles.portals}>
          <CollectionPortal collection={collections.sins} />
          <CollectionPortal collection={collections.cloud} flipped />
        </div>
      </section>

      <hr className="rule" />

      {/* The pieces. */}
      <section className="shell chapter">
        <div className={styles.pieces}>
          <Reveal className={styles.piecesHead}>
            <h2 className="label">{site.drop} — First pieces</h2>
            <ActionLink href="/shop" variant="ghost" inline>
              See everything
            </ActionLink>
          </Reveal>
          <ProductGrid products={featured} />
        </div>
      </section>

      {/* The turn: story ends, shop begins. */}
      <section className="shell">
        <Reveal className={styles.close}>
          <Star size={14} />
          <p className={`gothic chrome-text ${styles.closeLine}`}>Now, wear it.</p>
          <ActionLink href="/shop" inline>
            Enter the shop
          </ActionLink>
        </Reveal>
      </section>
    </>
  );
}

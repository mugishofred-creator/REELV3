import { ActionLink } from "./Action";
import { Artwork } from "./Artwork";
import { ProductGrid } from "./ProductGrid";
import { Reveal } from "./Reveal";
import { Star } from "./Star";
import { collections, getProductsByCollection, type CollectionId } from "@/lib/products";
import styles from "./CollectionView.module.css";

const HEAD_ART: Record<CollectionId, string> = { sins: "100%", cloud: "48%" };

export function CollectionView({ id }: { id: CollectionId }) {
  const collection = collections[id];
  const products = getProductsByCollection(id);
  const other = collections[id === "sins" ? "cloud" : "sins"];

  return (
    <>
      <header
        className={styles.head}
        style={{ ["--head-art" as string]: HEAD_ART[id] }}
      >
        <Artwork
          name={collection.artwork}
          sizes="(min-width: 56rem) 32rem, 90vw"
          priority
          className={styles.art}
        />
        <div className={styles.core}>
          <p className={`label ${styles.index}`}>
            <Star size={9} />
            Chapter {collection.index}
          </p>
          <h1 className={`gothic chrome-text ${styles.title}`}>{collection.title}</h1>
          <p className={`line ${styles.prompt}`}>{collection.prompt}</p>
        </div>
      </header>

      <hr className="rule" />

      <section className="shell chapter">
        <div className={styles.story}>
          <Reveal>
            <p className={styles.statement}>{collection.line}</p>
          </Reveal>
          <Reveal className={styles.paragraphs} delay={120}>
            {collection.story.map((paragraph) => (
              <p key={paragraph} className="prose">
                {paragraph}
              </p>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="shell chapter">
        <div className={styles.pieces}>
          <Reveal>
            <h2 className="label">The pieces — {products.length}</h2>
          </Reveal>
          <ProductGrid products={products} showCollection={false} />
        </div>
      </section>

      <hr className="rule" />

      <section className="shell">
        <Reveal className={styles.next}>
          <p className="label">{other.prompt}</p>
          <p className={`gothic chrome-text ${styles.nextTitle}`}>{other.title}</p>
          <ActionLink href={`/${other.id}`} variant="ghost" inline>
            Enter {other.title}
          </ActionLink>
        </Reveal>
      </section>
    </>
  );
}

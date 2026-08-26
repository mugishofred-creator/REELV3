import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { Reveal } from "@/components/Reveal";
import { collections, getProductsByCollection, type CollectionId } from "@/lib/products";
import { site } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Shop — Drop 001",
  description:
    "Drop 001 in full: SINS, what we carry, and CLOUD, what we look toward. Tees, hoodies and longsleeves from Lord Forgive Me.",
  alternates: { canonical: "/shop" },
};

const ORDER: CollectionId[] = ["sins", "cloud"];

export default function ShopPage() {
  return (
    <div className="shell">
      <header className={styles.head}>
        <p className="label">{site.drop}</p>
        <h1 className={`gothic chrome-text ${styles.title}`}>Now, wear it.</h1>
        <nav className={styles.jump} aria-label="Collections">
          {ORDER.map((id) => (
            <Link key={id} href={`#${id}`} className={styles.jumpLink}>
              {collections[id].title}
            </Link>
          ))}
        </nav>
      </header>

      {ORDER.map((id) => {
        const collection = collections[id];
        return (
          <section key={id} id={id} className={`${styles.section} chapter`}>
            <Reveal className={styles.sectionHead}>
              <h2 className={`gothic chrome-text ${styles.sectionTitle}`}>{collection.title}</h2>
              <p className={styles.sectionPrompt}>{collection.prompt}</p>
            </Reveal>
            <ProductGrid products={getProductsByCollection(id)} showCollection={false} />
          </section>
        );
      })}
    </div>
  );
}

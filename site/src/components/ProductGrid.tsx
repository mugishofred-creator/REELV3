import type { Product } from "@/lib/products";
import { ProductCard } from "./ProductCard";
import { Reveal } from "./Reveal";
import styles from "./ProductGrid.module.css";

export function ProductGrid({
  products,
  showCollection = true,
}: {
  products: Product[];
  showCollection?: boolean;
}) {
  return (
    <ul className={styles.grid}>
      {products.map((product, index) => (
        <Reveal as="li" key={product.slug} delay={Math.min(index, 3) * 90}>
          <ProductCard
            product={product}
            priority={index < 2}
            showCollection={showCollection}
          />
        </Reveal>
      ))}
    </ul>
  );
}

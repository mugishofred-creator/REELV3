import Link from "next/link";
import { formatPrice } from "@/lib/money";
import type { Product } from "@/lib/products";
import { ProductVisual } from "./ProductVisual";
import styles from "./ProductCard.module.css";

export function ProductCard({
  product,
  priority = false,
  showCollection = true,
}: {
  product: Product;
  priority?: boolean;
  showCollection?: boolean;
}) {
  return (
    <Link href={`/shop/${product.slug}`} className={styles.card}>
      <ProductVisual product={product} priority={priority} />
      <div className={styles.meta}>
        <h3 className={styles.name}>{product.name}</h3>
        <span className={styles.price}>{formatPrice(product.price, product.currency)}</span>
      </div>
      {showCollection && <p className={styles.collection}>{product.collection}</p>}
    </Link>
  );
}

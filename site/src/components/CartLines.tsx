"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { ProductVisual } from "./ProductVisual";
import styles from "./CartLines.module.css";

export function CartLines({ onNavigate }: { onNavigate?: () => void }) {
  const { resolved, setQuantity, remove } = useCart();

  if (resolved.length === 0) {
    return <p className={styles.empty}>You are carrying nothing yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {resolved.map((line) => (
        <li key={`${line.slug}-${line.size}`} className={styles.line}>
          <Link
            href={`/shop/${line.slug}`}
            className={styles.thumb}
            onClick={onNavigate}
            tabIndex={-1}
            aria-hidden="true"
          >
            <ProductVisual product={line.product} sizes="72px" />
          </Link>

          <div className={styles.body}>
            <div className={styles.top}>
              <Link href={`/shop/${line.slug}`} className={styles.name} onClick={onNavigate}>
                {line.product.name}
              </Link>
              <span className={styles.price}>
                {formatPrice(line.total, line.product.currency)}
              </span>
            </div>
            <p className={styles.size}>Size {line.size}</p>

            <div className={styles.controls}>
              <div className={styles.quantity}>
                <button
                  type="button"
                  className={styles.step}
                  onClick={() => setQuantity(line.slug, line.size, line.quantity - 1)}
                  aria-label={`Remove one ${line.product.name}, size ${line.size}`}
                >
                  &minus;
                </button>
                <span className={styles.value} aria-live="polite">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  className={styles.step}
                  onClick={() => setQuantity(line.slug, line.size, line.quantity + 1)}
                  aria-label={`Add one ${line.product.name}, size ${line.size}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={styles.remove}
                onClick={() => remove(line.slug, line.size)}
              >
                Put it down
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

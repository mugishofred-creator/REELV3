"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/products";
import { ActionButton } from "./Action";
import styles from "./AddToCart.module.css";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [size, setSize] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const submit = () => {
    if (!size) {
      setStatus("Choose a size first.");
      return;
    }
    add(product.slug, size);
    setStatus("Taken up.");
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.sizes}>
        <p className={styles.legend} id={`size-${product.slug}`}>
          Size
        </p>
        <div className={styles.options} role="group" aria-labelledby={`size-${product.slug}`}>
          {product.sizes.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.size}
              aria-pressed={size === option}
              onClick={() => {
                setSize(option);
                setStatus("");
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <ActionButton onClick={submit}>Carry it</ActionButton>
      <p className={styles.status} role="status">
        {status}
      </p>
    </div>
  );
}

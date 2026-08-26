"use client";

import { useState } from "react";
import { ActionButton, ActionLink } from "@/components/Action";
import { CartLines } from "@/components/CartLines";
import { useCart } from "@/lib/cart";
import { beginCheckout } from "@/lib/commerce";
import { formatPrice } from "@/lib/money";
import styles from "./page.module.css";

export function CartSummary() {
  const { lines, subtotal, count } = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const checkout = async () => {
    setPending(true);
    const result = await beginCheckout(lines);
    setPending(false);
    if (result.status === "redirect") window.location.href = result.url;
    else setNotice(result.message);
  };

  return (
    <>
      <CartLines />

      {count > 0 ? (
        <div className={styles.summary}>
          <p className={styles.total}>
            <span>Subtotal</span>
            <span className={styles.value}>{formatPrice(subtotal)}</span>
          </p>
          <ActionButton onClick={checkout} disabled={pending}>
            {pending ? "One moment" : "Checkout"}
          </ActionButton>
          <p className={styles.note} role="status">
            {notice ?? "Shipping and taxes settled at checkout."}
          </p>
        </div>
      ) : (
        <div className={styles.actions}>
          <ActionLink href="/shop" variant="ghost" inline>
            See Drop 001
          </ActionLink>
        </div>
      )}
    </>
  );
}

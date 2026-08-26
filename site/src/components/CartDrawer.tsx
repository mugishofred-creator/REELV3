"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { beginCheckout } from "@/lib/commerce";
import { formatPrice } from "@/lib/money";
import { ActionButton } from "./Action";
import { CartLines } from "./CartLines";
import styles from "./CartDrawer.module.css";

export function CartDrawer() {
  const { isOpen, close, lines, subtotal, count } = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) setNotice(null);
  }, [isOpen]);

  const checkout = async () => {
    setPending(true);
    const result = await beginCheckout(lines);
    setPending(false);
    if (result.status === "redirect") window.location.href = result.url;
    else setNotice(result.message);
  };

  return (
    <>
      {isOpen && (
        <div className={styles.backdrop} data-open={isOpen} onClick={close} aria-hidden="true" />
      )}
      <aside
        className={styles.panel}
        data-open={isOpen}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Your selection"
        inert={!isOpen}
      >
        <div className={styles.head}>
          <h2 className={styles.title}>What you carry{count > 0 ? ` (${count})` : ""}</h2>
          <button ref={closeButton} type="button" className={styles.close} onClick={close}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          <CartLines onNavigate={close} />
        </div>

        {count > 0 && (
          <div className={styles.foot}>
            <p className={styles.total}>
              <span>Subtotal</span>
              <span className={styles.totalValue}>{formatPrice(subtotal)}</span>
            </p>
            <ActionButton onClick={checkout} disabled={pending}>
              {pending ? "One moment" : "Checkout"}
            </ActionButton>
            <p className={styles.note} role="status">
              {notice ?? "Shipping and taxes settled at checkout."}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

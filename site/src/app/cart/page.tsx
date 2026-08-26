import type { Metadata } from "next";
import { CartSummary } from "./CartSummary";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "What you carry",
  description: "Your selection from Drop 001.",
  robots: { index: false },
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  return (
    <div className={`shell ${styles.wrap}`}>
      <p className="label">Your selection</p>
      <h1 className={`gothic chrome-text ${styles.title}`}>What you carry</h1>
      <CartSummary />
    </div>
  );
}

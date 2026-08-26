"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProduct, type Product } from "./products";

const STORAGE_KEY = "lfm.cart.v1";

export type CartLine = { slug: string; size: string; quantity: number };
export type ResolvedLine = CartLine & { product: Product; total: number };

type CartValue = {
  lines: CartLine[];
  resolved: ResolvedLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  add: (slug: string, size: string, quantity?: number) => void;
  setQuantity: (slug: string, size: string, quantity: number) => void;
  remove: (slug: string, size: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartValue | null>(null);

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as CartLine).slug === "string" &&
        typeof (line as CartLine).size === "string" &&
        Number.isFinite((line as CartLine).quantity),
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    setLines(read());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable — the cart simply does not survive the session */
    }
  }, [lines]);

  const add = useCallback((slug: string, size: string, quantity = 1) => {
    setLines((current) => {
      const index = current.findIndex((line) => line.slug === slug && line.size === size);
      if (index === -1) return [...current, { slug, size, quantity }];
      const next = [...current];
      next[index] = { ...next[index], quantity: next[index].quantity + quantity };
      return next;
    });
    setOpen(true);
  }, []);

  const setQuantity = useCallback((slug: string, size: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => !(line.slug === slug && line.size === size))
        : current.map((line) =>
            line.slug === slug && line.size === size ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const remove = useCallback((slug: string, size: string) => {
    setLines((current) => current.filter((line) => !(line.slug === slug && line.size === size)));
  }, []);

  const value = useMemo<CartValue>(() => {
    const resolved = lines.flatMap<ResolvedLine>((line) => {
      const product = getProduct(line.slug);
      if (!product) return [];
      return [{ ...line, product, total: product.price * line.quantity }];
    });
    return {
      lines,
      resolved,
      count: resolved.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: resolved.reduce((sum, line) => sum + line.total, 0),
      isOpen,
      add,
      setQuantity,
      remove,
      clear: () => setLines([]),
      open: () => setOpen(true),
      close: () => setOpen(false),
    };
  }, [lines, isOpen, add, setQuantity, remove]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

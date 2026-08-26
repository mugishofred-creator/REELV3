import type { CartLine } from "./cart";

export type CheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "unavailable"; message: string };

/**
 * The single seam between this site and a payment provider.
 *
 * Point NEXT_PUBLIC_CHECKOUT_ENDPOINT at a route that turns cart lines into a
 * hosted checkout (Stripe session, Shopify cart permalink, anything) and returns
 * `{ url }`. Until then the shop is a lookbook that remembers your selection.
 */
export async function beginCheckout(lines: CartLine[]): Promise<CheckoutResult> {
  const endpoint = process.env.NEXT_PUBLIC_CHECKOUT_ENDPOINT;

  if (!endpoint) {
    return {
      status: "unavailable",
      message: "Drop 001 has not opened. Your selection is kept.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { url?: string };
    if (!data.url) throw new Error("no checkout url");
    return { status: "redirect", url: data.url };
  } catch {
    return { status: "unavailable", message: "Checkout could not open. Try again." };
  }
}

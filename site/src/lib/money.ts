const formatters = new Map<string, Intl.NumberFormat>();

/** Minor units in, display string out. */
export function formatPrice(amount: number, currency = "EUR", locale = "fr-FR"): string {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(amount / 100);
}

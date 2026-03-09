/**
 * Formats a number as Pakistani Rupee (PKR).
 * Output example: "PKR 50,000"
 */
export const formatPKR = (amount: number): string =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

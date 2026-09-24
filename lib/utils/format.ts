export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMileage(miles: number | null | undefined): string {
  if (miles == null) return "Unlimited";
  return `${miles.toLocaleString("en-US")} mi/day`;
}

export function formatHorsepower(hp: number | null | undefined): string {
  if (hp == null) return "—";
  return `${hp.toLocaleString("en-US")} hp`;
}

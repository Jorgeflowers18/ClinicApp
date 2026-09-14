export function formatCurrency(value: number): string {
  return value.toLocaleString("es-EC", { style: "currency", currency: "USD" })
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

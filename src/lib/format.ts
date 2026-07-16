export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
export function formatDate(iso: string) {
  // Support bare YYYY-MM-DD without timezone shift surprises
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Meta returns CTR already as a percentage (e.g. 1.25 = 1.25%). */
export function formatMetaPercent(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatMetaCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatCurrency(value);
}

export function formatMetaNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatNumber(value);
}

export function formatRoas(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatFreq(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

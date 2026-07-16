/** Calendar YYYY-MM-DD in a timezone (avoids UTC day-shift near midnight). */
export function ymdInTz(d: Date = new Date(), timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shiftYmd(ymd: string, days: number, timeZone = "America/Sao_Paulo"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymdInTz(dt, timeZone);
}

/** Inclusive period ending today (or `to`), spanning `spanDays` calendar days. */
export function periodRange(spanDays: number, timeZone = "America/Sao_Paulo") {
  const to = ymdInTz(new Date(), timeZone);
  const from = shiftYmd(to, -(Math.max(1, spanDays) - 1), timeZone);
  return { dateFrom: from, dateTo: to };
}

export const WEEK_MS = 7 * 86_400_000;

/** Monday 00:00 UTC of the week containing `ms`, as epoch milliseconds. */
export function startOfUtcWeek(ms: number): number {
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fixed reference time for seeded demo data, so server and client render identically. */
export const BASE_TIME = Date.parse("2026-10-28T04:00:00Z");

export const minutesAgo = (m: number) => new Date(BASE_TIME - m * 60_000).toISOString();

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC HH:MM:SS */
export function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** UTC "Oct 28 · 03:12" */
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${mon} ${d.getUTCDate()} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

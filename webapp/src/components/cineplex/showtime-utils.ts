import type { ShowSession } from "../../../../backend/src/types";

// Format a YYYY-MM-DD (or full ISO local) string into weekday + month/day parts.
// Cineplex dates are local wall-clock strings; parse the date part directly so
// we never shift across a timezone boundary.
export function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function weekdayLabel(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", { weekday: "short" });
}

// e.g. "Jul 23"
export function monthDayLabel(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// e.g. "Thu Jul 23" — compact single-line label used on the poster overlay.
export function shortDateLabel(dateStr: string): string {
  return `${weekdayLabel(dateStr)} ${monthDayLabel(dateStr)}`;
}

// Format a local ISO datetime ("2026-07-23T12:15:00") into "12:15 PM".
export function formatTime(startDateTime: string): string {
  const timePart = startDateTime.slice(11, 16); // "12:15"
  const [hStr, mStr] = timePart.split(":");
  let hours = Number(hStr);
  const minutes = mStr ?? "00";
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

// The API returns multiple rows sharing the same sessionId, each carrying a
// different subset of experienceTypes. Collapse them into one session per
// sessionId, unioning the experience types, and sort by start time ascending.
export function groupSessions(sessions: ShowSession[]): ShowSession[] {
  const byId = new Map<number, ShowSession>();

  for (const s of sessions) {
    const existing = byId.get(s.sessionId);
    if (!existing) {
      byId.set(s.sessionId, { ...s, experienceTypes: [...(s.experienceTypes ?? [])] });
      continue;
    }
    const merged = new Set<string>([
      ...(existing.experienceTypes ?? []),
      ...(s.experienceTypes ?? []),
    ]);
    existing.experienceTypes = [...merged];
    // Prefer any non-null ticketing url / auditorium / seat info we can find.
    if (!existing.ticketingUrl && s.ticketingUrl) existing.ticketingUrl = s.ticketingUrl;
    if (!existing.auditorium && s.auditorium) existing.auditorium = s.auditorium;
    if (existing.seatsRemaining == null && s.seatsRemaining != null) {
      existing.seatsRemaining = s.seatsRemaining;
    }
    existing.isSoldOut = existing.isSoldOut || s.isSoldOut;
  }

  return [...byId.values()].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

// Experience types that deserve a highlighted accent badge.
const PREMIUM_FORMATS = new Set(["IMAX", "ULTRAAVX", "VIP"]);

export function isPremiumFormat(format: string): boolean {
  return PREMIUM_FORMATS.has(format.replace(/[\s-]/g, "").toUpperCase());
}

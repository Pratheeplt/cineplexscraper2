// Shared formatting helpers for the Notify tab.

export function formatDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function formatTime(dateTime: string): string {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return dateTime;
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(dateTime: string): string {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return dateTime;
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Colour a format/experience badge by its type. Falls back to a neutral style.
export function experienceClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("imax")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (t.includes("ultraavx") || t.includes("ultra avx"))
    return "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30";
  if (t.includes("vip")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (t.includes("recliner")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (t.includes("3d")) return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
  if (t.includes("d-box") || t.includes("dbox")) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-primary/10 text-primary border-primary/30";
}

// All distinct experience formats present across a set of sessions.
export function distinctFormats(sessions: { experienceTypes: string[] }[]): string[] {
  const set = new Set<string>();
  for (const s of sessions) for (const t of s.experienceTypes) set.add(t);
  return Array.from(set);
}

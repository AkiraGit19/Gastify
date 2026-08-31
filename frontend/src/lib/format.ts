export function relativeDate(dateStr: string) {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (diffDays < 1) return rtf.format(0, "day");
  return rtf.format(-diffDays, "day");
}

export function money(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

// Strips accents so a search for "ferreteria" matches "Ferretería" — in Spanish text, requiring
// the exact tilde is the difference between a search box that works and one that never does.
export function normalizeSearch(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function relativeDate(dateStr: string) {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (diffDays < 1) return rtf.format(0, "day");
  return rtf.format(-diffDays, "day");
}

export function money(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

// Custom mark, not a stock icon: a small torn receipt, echoing the perforated-card motif used
// throughout the product instead of an arbitrary icon-in-a-box.
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 3.5C5 3.22 5.22 3 5.5 3h13c.28 0 .5.22.5.5v13.9l-1.5-1.1-1.5 1.1-1.5-1.1-1.5 1.1-1.5-1.1-1.5 1.1-1.5-1.1-1.5 1.1V3.5Z"
        fill="var(--color-brand)"
      />
      <path d="M8 8h8M8 11.3h8M8 14.6h5" stroke="var(--color-rail)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

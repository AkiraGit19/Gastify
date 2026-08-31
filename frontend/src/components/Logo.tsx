// Two offset parallelogram bars forming an abstract ascending mark — reads as
// "movement/flow of spend," geometric and flat like a wordmark companion, not an icon-in-a-box.
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 16.5 9 3l4.2 2.3L6.2 18.8 2 16.5Z" fill="var(--color-rail)" />
      <path d="M9.8 20 16.8 6.5l4.2 2.3L14 22.3 9.8 20Z" fill="var(--color-brand)" />
    </svg>
  );
}

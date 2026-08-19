import { useEffect, useRef, useState } from "react";

export function CountUp({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const start = useRef<number | null>(null);
  const duration = 600;

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    start.current = null;
    let frame: number;

    function tick(timestamp: number) {
      if (start.current === null) start.current = timestamp;
      const progress = Math.min((timestamp - start.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

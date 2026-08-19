export function ReceiptThumb({ url, scanning = false }: { url: string; scanning?: boolean }) {
  return (
    <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md border border-brand-soft bg-page">
      <img src={url} alt="Boleta" className="h-full w-full object-cover" />
      {scanning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="h-1/4 w-full bg-gradient-to-b from-transparent via-brand/70 to-transparent animate-scan" />
        </div>
      )}
    </div>
  );
}

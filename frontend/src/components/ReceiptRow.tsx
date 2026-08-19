import type { ReactNode } from "react";
import { ReceiptThumb } from "./ReceiptThumb";
import { StatusPill } from "./StatusPill";

export function ReceiptRow({
  imagenUrl,
  scanning,
  title,
  meta,
  amount,
  estado,
  action,
}: {
  imagenUrl: string;
  scanning?: boolean;
  title: string;
  meta: string;
  amount: string;
  estado: string;
  action?: ReactNode;
}) {
  return (
    <div className="receipt-card flex items-center gap-4 px-4 py-3.5">
      <ReceiptThumb url={imagenUrl} scanning={scanning} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="truncate text-xs text-muted">{meta}</p>
      </div>
      <p className="font-mono text-sm font-semibold text-ink">{amount}</p>
      <StatusPill estado={estado} />
      {action}
    </div>
  );
}

import { useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "./Modal";

export function ReceiptViewer({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-page hover:text-ink"
        aria-label="Ver comprobante"
      >
        <Eye size={16} />
      </button>
      {open && (
        <Modal title="Comprobante" onClose={() => setOpen(false)}>
          <img src={url} alt="Comprobante" className="w-full rounded-lg" />
        </Modal>
      )}
    </>
  );
}

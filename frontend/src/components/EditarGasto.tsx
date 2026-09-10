import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Modal } from "./Modal";
import { CATEGORIA_LABEL, TIPO_COMPROBANTE_LABEL, type Gasto, type TipoComprobante } from "../lib/types";

// Antes de esto un gasto era inmutable: un monto mal leído se quedaba así para siempre y lo único
// que podía hacer el aprobador era rechazarlo, dejando al empleado sin salida. Este formulario es
// el camino de vuelta, y por eso muestra la boleta al lado — se corrige mirando el original.
export function EditarGasto({ gasto, onClose, onSaved }: { gasto: Gasto; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  // El tipo de comprobante y el IGV deciden si la empresa puede reclamar crédito fiscal. Eso lo
  // define quien revisa, no quien rinde; el backend lo vuelve a comprobar.
  const puedeContabilidad = user?.rol === "admin" || user?.rol === "aprobador";

  const [form, setForm] = useState({
    monto: Number(gasto.monto).toFixed(2),
    fechaGasto: gasto.fechaGasto.slice(0, 10),
    categoria: gasto.categoria,
    tipoComprobante: gasto.tipoComprobante,
    rucEmisor: gasto.rucEmisor ?? "",
    razonSocialEmisor: gasto.razonSocialEmisor ?? "",
    numeroComprobante: gasto.numeroComprobante ?? "",
    igv: gasto.igv === null ? "" : Number(gasto.igv).toFixed(2),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Solo viajan los campos que de verdad cambiaron. Mandar todo haría que el backend tomara el
    // IGV actual como "fijado a mano" y dejara de recalcularlo al corregir el monto.
    const cambios: Record<string, unknown> = {};
    if (form.monto !== Number(gasto.monto).toFixed(2)) cambios.monto = Number(form.monto.replace(",", "."));
    if (form.fechaGasto !== gasto.fechaGasto.slice(0, 10)) cambios.fechaGasto = form.fechaGasto;
    if (form.categoria !== gasto.categoria) cambios.categoria = form.categoria;
    if (form.rucEmisor !== (gasto.rucEmisor ?? "")) cambios.rucEmisor = form.rucEmisor || null;
    if (form.razonSocialEmisor !== (gasto.razonSocialEmisor ?? "")) cambios.razonSocialEmisor = form.razonSocialEmisor || null;
    if (form.numeroComprobante !== (gasto.numeroComprobante ?? "")) cambios.numeroComprobante = form.numeroComprobante || null;
    if (puedeContabilidad) {
      if (form.tipoComprobante !== gasto.tipoComprobante) cambios.tipoComprobante = form.tipoComprobante;
      const igvOriginal = gasto.igv === null ? "" : Number(gasto.igv).toFixed(2);
      if (form.igv !== igvOriginal) cambios.igv = form.igv === "" ? null : Number(form.igv.replace(",", "."));
    }

    if (Object.keys(cambios).length === 0) return onClose();

    setGuardando(true);
    try {
      await api.patch(`/gastos/${gasto.id}`, cambios);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Corregir gasto" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <a href={gasto.imagenUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={gasto.imagenUrl}
            alt="Boleta"
            className="max-h-64 w-full rounded-md border border-ink/10 object-contain"
          />
          <span className="mt-1 block text-center text-xs text-muted">Abrir original</span>
        </a>

        <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
          <Campo label="Monto (S/)">
            <input required inputMode="decimal" value={form.monto} onChange={(e) => set("monto", e.target.value)} className={INPUT} />
          </Campo>
          <Campo label="Fecha">
            <input required type="date" value={form.fechaGasto} onChange={(e) => set("fechaGasto", e.target.value)} className={INPUT} />
          </Campo>

          <Campo label="Categoría">
            <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={INPUT}>
              {Object.entries(CATEGORIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo de comprobante">
            <select
              value={form.tipoComprobante}
              disabled={!puedeContabilidad}
              onChange={(e) => set("tipoComprobante", e.target.value as TipoComprobante)}
              className={INPUT}
            >
              {Object.entries(TIPO_COMPROBANTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Campo>

          <Campo label="RUC del emisor">
            <input value={form.rucEmisor} onChange={(e) => set("rucEmisor", e.target.value)} className={INPUT} />
          </Campo>
          <Campo label="N° de comprobante">
            <input value={form.numeroComprobante} onChange={(e) => set("numeroComprobante", e.target.value)} className={INPUT} />
          </Campo>

          <div className="col-span-2">
            <Campo label="Razón social">
              <input value={form.razonSocialEmisor} onChange={(e) => set("razonSocialEmisor", e.target.value)} className={INPUT} />
            </Campo>
          </div>

          {puedeContabilidad && (
            <div className="col-span-2">
              <Campo label="IGV (S/)">
                <input inputMode="decimal" value={form.igv} onChange={(e) => set("igv", e.target.value)} placeholder="Se calcula solo" className={INPUT} />
              </Campo>
              <p className="mt-1 text-xs text-muted">
                {form.tipoComprobante === "factura"
                  ? "Déjalo vacío para derivarlo del total. Solo cámbialo si el comprobante desglosa otro monto."
                  : "Solo las facturas dan derecho a crédito fiscal, así que este campo se ignora."}
              </p>
            </div>
          )}

          {error && <p className="col-span-2 text-sm text-stamp-rechazado">{error}</p>}

          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border border-ink/12 px-4 py-2 text-sm font-semibold text-muted">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

const INPUT = "w-full rounded-md border border-ink/12 bg-page px-3 py-2 text-sm text-ink disabled:opacity-60";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

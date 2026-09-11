import type { TipoComprobante } from "@prisma/client";

// IGV peruano: 16% de IGV + 2% de IPM. Va junto en el comprobante como una sola línea.
const TASA_IGV = 0.18;

// Umbral de bancarización: sobre este monto, SUNAT exige que el pago se haya hecho por un medio
// bancario para aceptar el gasto como deducible. No validamos el medio de pago —solo marcamos el
// gasto— porque el dato no está en la boleta y quien lo sabe es quien rinde.
export const UMBRAL_BANCARIZACION = 2000;

// La serie del comprobante dice qué es: F001 factura, B001 boleta, R001 recibo por honorarios.
//
// Ante la duda devuelve `otro`, nunca `factura`. El error tiene dirección: clasificar una boleta
// como factura hace que la empresa reclame un crédito fiscal que no le corresponde, y eso lo
// descubre SUNAT. Al revés solo se deja de reclamar algo que sí correspondía, y lo corrige una
// persona en la pantalla de revisión.
export function inferirTipoComprobante(numeroComprobante?: string | null): TipoComprobante {
  const serie = numeroComprobante?.trim().toUpperCase();
  if (!serie) return "otro";
  if (serie.startsWith("F")) return "factura";
  if (serie.startsWith("B")) return "boleta";
  if (serie.startsWith("R")) return "recibo_honorarios";
  return "otro";
}

// El IGV que se puede reclamar. Solo las facturas dan crédito fiscal: en una boleta el impuesto
// existe pero no es recuperable, así que devolver un número ahí sería inflar el crédito fiscal
// del cliente con plata que SUNAT no le va a reconocer.
//
// Si el OCR leyó el IGV impreso, se usa ese. Si no, se deriva del total, que es lo que hace a
// mano cualquier contador cuando la factura solo muestra el importe final. Queda editable
// porque hay operaciones exoneradas e inafectas donde esta cuenta no aplica.
export function calcularIgv(monto: number, tipo: TipoComprobante, igvLeido?: number | null): number | null {
  if (tipo !== "factura") return null;
  if (igvLeido != null && igvLeido >= 0) return redondear(igvLeido);
  return redondear(monto - monto / (1 + TASA_IGV));
}

export function requiereBancarizacion(monto: number): boolean {
  return monto > UMBRAL_BANCARIZACION;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// Qué IGV queda después de editar un gasto.
//
// El IGV depende del total y del tipo de comprobante, así que corregir un monto sin recalcularlo
// deja una cifra vieja que nadie va a volver a mirar. Se separa del handler porque es la clase de
// regla con tres ramas donde un error no se nota hasta que el contador cuadra el mes.
export function igvTrasEdicion(
  actual: { monto: number; tipoComprobante: TipoComprobante; igv: number | null },
  montoNuevo: number,
  tipoNuevo: TipoComprobante,
  igvExplicito?: number | null,
): number | null {
  // Quien revisa fijó el IGV a mano: manda sobre cualquier cálculo, salvo que el comprobante
  // no dé crédito fiscal, y de eso se encarga calcularIgv.
  if (igvExplicito !== undefined) return calcularIgv(montoNuevo, tipoNuevo, igvExplicito);

  // Nada que afecte al impuesto se movió: se respeta lo que ya estaba, incluido un IGV impreso
  // que no coincide con la cuenta del 18% (operaciones exoneradas, inafectas o mixtas).
  if (montoNuevo === actual.monto && tipoNuevo === actual.tipoComprobante) return actual.igv;

  return calcularIgv(montoNuevo, tipoNuevo);
}

// Códigos de tipo de comprobante de SUNAT. Solo se mapean los que su servicio de validación
// acepta: factura y boleta. Un recibo por honorarios o un "otro" no se pueden consultar, y
// pedirlo igual solo gastaría una llamada para recibir un error.
const CODIGO_SUNAT: Partial<Record<TipoComprobante, string>> = {
  factura: "01",
  boleta: "03",
};

export function codigoSunat(tipo: TipoComprobante): string | null {
  return CODIGO_SUNAT[tipo] ?? null;
}

// "F001-00000123" -> { serie: "F001", numero: "123" }
//
// SUNAT espera el correlativo sin ceros a la izquierda, pero las boletas lo imprimen con ellos
// y el OCR lo devuelve tal cual. Sin este recorte, la consulta da "no existe" para comprobantes
// perfectamente válidos, que es el peor resultado posible: parece fraude y no lo es.
export function partirComprobante(numeroComprobante?: string | null): { serie: string; numero: string } | null {
  const limpio = numeroComprobante?.trim().toUpperCase().replace(/\s+/g, "");
  if (!limpio) return null;

  const partes = limpio.split("-");
  if (partes.length !== 2) return null;

  const [serie, correlativo] = partes;
  if (!/^[A-Z0-9]{4}$/.test(serie)) return null;
  if (!/^\d+$/.test(correlativo)) return null;

  const numero = correlativo.replace(/^0+/, "") || "0";
  return { serie, numero };
}

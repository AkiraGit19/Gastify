import { requiereBancarizacion } from "./gastos/comprobante.js";

interface GastoRow {
  fechaGasto: Date;
  usuario: { nombre: string };
  categoria: string;
  tipoComprobante: string;
  monto: unknown;
  igv: unknown;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  numeroComprobante: string | null;
  estado: string;
  fechaPago: Date | null;
  observacionSunat: string | null;
}

// Excel en español usa el punto y coma como separador de listas y la coma como separador decimal.
// Con el formato "internacional" (coma y punto) el contador abre el archivo y ve todo apelotonado
// en una sola columna, o los montos convertidos en texto. Este export existe para que lo abra él,
// así que manda su Excel y no el estándar.
const SEP = ";";

// Sin BOM, Excel interpreta el archivo como Latin-1 y "Alimentación" llega como "AlimentaciÃ³n".
const BOM = "﻿";

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  recibo_honorarios: "Recibo por honorarios",
  otro: "Otro",
};

function escapeCsv(value: string) {
  if (value.includes(SEP) || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Los importes salen con coma decimal y sin separador de miles: agregar el punto de miles haría
// que Excel los tome como texto en cuanto la cifra pase de mil.
function numero(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const n = Number(valor);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

function fecha(valor: Date | null): string {
  return valor ? valor.toISOString().slice(0, 10) : "";
}

export function toCsv(gastos: GastoRow[]) {
  const header = [
    "Fecha", "Empleado", "Categoría", "Tipo comprobante", "RUC emisor", "Razón social",
    "Comprobante", "Subtotal", "IGV", "Total", "Requiere bancarización", "Estado", "Fecha de pago", "Observación SUNAT",
  ];

  const rows = gastos.map((g) => {
    const total = Number(g.monto);
    const igv = g.igv === null || g.igv === undefined ? null : Number(g.igv);
    // Solo las facturas traen IGV (ver comprobante.ts), así que en el resto subtotal y total
    // coinciden — que es exactamente lo que el contador necesita ver para saber qué no da
    // derecho a crédito fiscal.
    const subtotal = igv === null ? total : total - igv;

    return [
      fecha(g.fechaGasto),
      g.usuario.nombre,
      g.categoria,
      TIPO_LABEL[g.tipoComprobante] ?? g.tipoComprobante,
      g.rucEmisor ?? "",
      g.razonSocialEmisor ?? "",
      g.numeroComprobante ?? "",
      numero(subtotal),
      igv === null ? "" : numero(igv),
      numero(total),
      requiereBancarizacion(total) ? "Sí" : "",
      g.estado,
      fecha(g.fechaPago),
      g.observacionSunat ?? "",
    ]
      .map((v) => escapeCsv(String(v)))
      .join(SEP);
  });

  return BOM + [header.join(SEP), ...rows].join("\r\n");
}

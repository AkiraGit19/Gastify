interface GastoRow {
  fechaGasto: Date;
  usuario: { nombre: string };
  categoria: string;
  monto: unknown;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  numeroComprobante: string | null;
  estado: string;
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(gastos: GastoRow[]) {
  const header = ["Fecha", "Empleado", "Categoría", "Monto", "RUC emisor", "Razón social", "Comprobante", "Estado"];
  const rows = gastos.map((g) =>
    [
      g.fechaGasto.toISOString().slice(0, 10),
      g.usuario.nombre,
      g.categoria,
      String(g.monto),
      g.rucEmisor ?? "",
      g.razonSocialEmisor ?? "",
      g.numeroComprobante ?? "",
      g.estado,
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

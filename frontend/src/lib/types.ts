export interface Gasto {
  id: string;
  usuarioId: string;
  monto: string;
  fechaGasto: string;
  categoria: "movilidad" | "alimentacion" | "hospedaje" | "otros";
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  numeroComprobante: string | null;
  tipoComprobante: TipoComprobante;
  igv: string | null;
  imagenUrl: string;
  estado: EstadoGasto;
  validadoSunat: boolean;
  fechaCreacion: string;
  fechaPago: string | null;
  motivoAnulacion: string | null;
  usuario: { nombre: string };
}

export type EstadoGasto = "pendiente" | "aprobado" | "rechazado" | "pendiente_validacion" | "pagado" | "anulado";

export type TipoComprobante = "factura" | "boleta" | "recibo_honorarios" | "otro";

// Solo las facturas dan derecho a crédito fiscal en Perú; el resto se registra igual pero no
// se puede descontar. Por eso el tipo se muestra en la lista y no queda escondido en el detalle.
export const TIPO_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  factura: "Factura",
  boleta: "Boleta",
  recibo_honorarios: "R. honorarios",
  otro: "Otro",
};

export interface EdicionGasto {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  fecha: string;
  usuario: { nombre: string };
}

export interface Empresa {
  id: string;
  razonSocial: string;
  ruc: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefonoWhatsapp: string | null;
  rol: "admin" | "aprobador" | "empleado";
  activo: boolean;
  aprobadorId: string | null;
}

export const CATEGORIA_LABEL: Record<Gasto["categoria"], string> = {
  movilidad: "Movilidad",
  alimentacion: "Alimentación",
  hospedaje: "Hospedaje",
  otros: "Otros",
};

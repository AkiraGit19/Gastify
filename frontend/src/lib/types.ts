export interface Gasto {
  id: string;
  usuarioId: string;
  monto: string;
  fechaGasto: string;
  categoria: "movilidad" | "alimentacion" | "hospedaje" | "otros";
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  numeroComprobante: string | null;
  imagenUrl: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "pendiente_validacion";
  validadoSunat: boolean;
  fechaCreacion: string;
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

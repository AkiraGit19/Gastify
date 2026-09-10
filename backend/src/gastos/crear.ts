import { db } from "../db.js";
import { validarRuc } from "../whatsapp/sunat.js";

// Único lugar donde nace un gasto. Lo usan el panel web y el bot de WhatsApp: si la
// deduplicación o la validación SUNAT vivieran en cada canal, tarde o temprano uno de los dos
// se quedaría sin el arreglo que se le hizo al otro.

export interface DatosGasto {
  monto: number;
  fecha: Date;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  imagenUrl: string;
  categoria: string;
}

export interface UsuarioGasto {
  id: string;
  empresaId: string | null;
  aprobadorId: string | null;
}

export type ResultadoGasto =
  | { ok: true; gastoId: string; aprobador: { id: string; nombre: string; telefonoWhatsapp: string | null } | null }
  | { ok: false; motivo: "duplicado" };

export async function crearGasto(usuario: UsuarioGasto, datos: DatosGasto): Promise<ResultadoGasto> {
  // Se comprueba contra los datos finales, no contra la lectura cruda del OCR: el empleado
  // completa ruc/comprobante a mano cuando no se pudieron leer, y chequear los valores previos
  // saltaría esta verificación justo en las boletas escritas a mano.
  if (datos.rucEmisor && datos.numeroComprobante) {
    const duplicado = await db.gasto.findFirst({
      where: {
        empresaId: usuario.empresaId!,
        rucEmisor: datos.rucEmisor,
        numeroComprobante: datos.numeroComprobante,
      },
    });
    if (duplicado) return { ok: false, motivo: "duplicado" };
  }

  const sunat = datos.rucEmisor ? await validarRuc(datos.rucEmisor) : { disponible: false, activo: false };

  const gasto = await db.gasto.create({
    data: {
      empresaId: usuario.empresaId!,
      usuarioId: usuario.id,
      monto: datos.monto,
      fechaGasto: datos.fecha,
      categoria: datos.categoria as any,
      rucEmisor: datos.rucEmisor,
      razonSocialEmisor: datos.proveedor,
      numeroComprobante: datos.numeroComprobante,
      imagenUrl: datos.imagenUrl,
      // Un validador que no responde no es prueba de una boleta mala: queda pendiente de
      // validación para que la revise una persona, nunca rechazada de forma automática.
      estado: sunat.disponible ? "pendiente" : "pendiente_validacion",
      validadoSunat: sunat.disponible ? Boolean(sunat.activo) : false,
    },
  });

  const aprobador = usuario.aprobadorId
    ? await db.usuario.findUnique({
        where: { id: usuario.aprobadorId },
        select: { id: true, nombre: true, telefonoWhatsapp: true },
      })
    : null;

  return { ok: true, gastoId: gasto.id, aprobador };
}

// Acepta DD/MM/AAAA (lo que devuelve el lector de boletas). Sin fecha o con una fecha que no
// entiende, cae a hoy: un gasto con fecha aproximada es corregible, uno que no se pudo registrar
// obliga al empleado a repetir todo el proceso.
export function parseFecha(fecha?: string): Date {
  if (!fecha) return new Date();
  const match = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return new Date();
  const [, dd, mm, yyyy] = match;
  const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { validarRuc } from "../whatsapp/sunat.js";
import { inferirTipoComprobante, calcularIgv } from "./comprobante.js";

// Único lugar donde nace un gasto. Lo usan el panel web y el bot de WhatsApp: si la
// deduplicación o la validación SUNAT vivieran en cada canal, tarde o temprano uno de los dos
// se quedaría sin el arreglo que se le hizo al otro.

export interface DatosGasto {
  monto: number;
  fecha: Date;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  igvLeido?: number;
  imagenUrl: string;
  imagenHash?: string;
  categoria: string;
}

// Estados que ya no ocupan lugar: un gasto anulado o rechazado no debe impedir que se vuelva a
// registrar el comprobante correcto.
const ESTADOS_VIGENTES = ["pendiente", "pendiente_validacion", "aprobado", "pagado"] as const;

export function hashImagen(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export interface UsuarioGasto {
  id: string;
  empresaId: string | null;
  aprobadorId: string | null;
}

export type ResultadoGasto =
  | { ok: true; gastoId: string; aprobador: { id: string; nombre: string; telefonoWhatsapp: string | null } | null }
  | { ok: false; motivo: "duplicado"; detalle: string };

export async function crearGasto(usuario: UsuarioGasto, datos: DatosGasto): Promise<ResultadoGasto> {
  // La misma foto, byte por byte, es la misma boleta. Es la única defensa cuando el OCR no pudo
  // leer ni el RUC ni el número de comprobante, que es justo lo que pasa con papel térmico gastado.
  if (datos.imagenHash) {
    const mismaFoto = await db.gasto.findFirst({
      where: { empresaId: usuario.empresaId!, imagenHash: datos.imagenHash, estado: { in: [...ESTADOS_VIGENTES] } },
    });
    if (mismaFoto) return { ok: false, motivo: "duplicado", detalle: "Esta misma foto ya fue registrada antes." };
  }

  // Se comprueba contra los datos finales, no contra la lectura cruda del OCR: el empleado
  // completa ruc/comprobante a mano cuando no se pudieron leer, y chequear los valores previos
  // saltaría esta verificación justo en las boletas escritas a mano.
  if (datos.rucEmisor && datos.numeroComprobante) {
    const duplicado = await db.gasto.findFirst({
      where: {
        empresaId: usuario.empresaId!,
        rucEmisor: datos.rucEmisor,
        numeroComprobante: datos.numeroComprobante,
        estado: { in: [...ESTADOS_VIGENTES] },
      },
    });
    if (duplicado) return { ok: false, motivo: "duplicado", detalle: "Ese comprobante ya está registrado." };
  }

  // Mismo empleado, mismo monto, mismo día. No lo bloqueamos —dos taxis iguales el mismo día
  // existen— pero tampoco lo dejamos pasar derecho: se manda a revisión humana, que es lo que
  // significa pendiente_validacion. El empleado no ve fricción; la ve quien ya estaba revisando.
  const inicioDia = new Date(datos.fecha);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setUTCDate(finDia.getUTCDate() + 1);
  const sospechoso = await db.gasto.findFirst({
    where: {
      empresaId: usuario.empresaId!,
      usuarioId: usuario.id,
      monto: new Prisma.Decimal(datos.monto),
      fechaGasto: { gte: inicioDia, lt: finDia },
      estado: { in: [...ESTADOS_VIGENTES] },
    },
  });

  const tipoComprobante = inferirTipoComprobante(datos.numeroComprobante);
  const igv = calcularIgv(datos.monto, tipoComprobante, datos.igvLeido);

  const sunat = datos.rucEmisor ? await validarRuc(datos.rucEmisor) : { disponible: false, activo: false };

  // El índice único de (empresa, ruc, comprobante) es la red de seguridad de la comprobación de
  // arriba: dos subidas simultáneas de la misma boleta pasan las dos por el findFirst, y es la
  // base la que corta la segunda. También salta si el original está anulado, porque el índice no
  // distingue estados — por eso el mensaje sugiere editar en vez de volver a subir.
  let gasto;
  try {
    gasto = await db.gasto.create({
      data: {
        empresaId: usuario.empresaId!,
        usuarioId: usuario.id,
        monto: datos.monto,
        fechaGasto: datos.fecha,
        categoria: datos.categoria as any,
        rucEmisor: datos.rucEmisor,
        razonSocialEmisor: datos.proveedor,
        numeroComprobante: datos.numeroComprobante,
        tipoComprobante,
        igv,
        imagenUrl: datos.imagenUrl,
        imagenHash: datos.imagenHash,
        // Un validador que no responde no es prueba de una boleta mala: queda pendiente de
        // validación para que la revise una persona, nunca rechazada de forma automática.
        estado: sunat.disponible && !sospechoso ? "pendiente" : "pendiente_validacion",
        validadoSunat: sunat.disponible ? Boolean(sunat.activo) : false,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, motivo: "duplicado", detalle: "Ya existe un gasto con ese comprobante. Si necesitas corregirlo, edita el original." };
    }
    throw err;
  }

  const aprobador = usuario.aprobadorId
    ? await db.usuario.findUnique({
        where: { id: usuario.aprobadorId },
        select: { id: true, nombre: true, telefonoWhatsapp: true },
      })
    : null;

  return { ok: true, gastoId: gasto.id, aprobador };
}

// Acepta los dos formatos que llegan de verdad: DD/MM/AAAA del lector de boletas y AAAA-MM-DD
// del <input type="date"> del panel. Sin el segundo, corregir una fecha a mano la mandaba
// silenciosamente a hoy — el peor final posible para un campo que el usuario acaba de escribir.
//
// Sin fecha o con una que no entiende cae a hoy: un gasto con fecha aproximada se corrige, uno
// que no se pudo registrar obliga al empleado a repetir todo.
export function parseFecha(fecha?: string): Date {
  if (!fecha) return new Date();

  const iso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const latino = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!iso && !latino) return new Date();

  const [yyyy, mm, dd] = iso ? [iso[1], iso[2], iso[3]] : [latino![3], latino![2], latino![1]];
  const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return new Date();

  // new Date("2025-02-30") no existe, pero "2025-99-99" tampoco y JS lo redondea a otro mes en
  // vez de fallar. Se comprueba que la fecha resultante sea la que se pidió.
  if (parsed.getUTCMonth() + 1 !== Number(mm) || parsed.getUTCDate() !== Number(dd)) return new Date();

  return parsed;
}

import { db } from "../db.js";
import { readReceipt } from "./ocr.js";
import { validarRuc } from "./sunat.js";
import { downloadWhatsAppMedia, storeReceiptImage } from "./media.js";
import { sendText, sendButtons } from "./send.js";

const CATEGORIAS = ["movilidad", "alimentacion", "hospedaje", "otros"] as const;
const CAMPO_LABELS: Record<string, string> = {
  monto: "el monto",
  fecha: "la fecha (DD/MM/AAAA)",
  proveedor: "el nombre del proveedor",
  rucEmisor: "el RUC del emisor",
  numeroComprobante: "el número de comprobante",
};

interface Draft {
  monto?: number;
  fecha?: string;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  imagenUrl?: string;
  categoria?: string;
  camposPendientes: string[];
}

type IncomingMessage =
  | { type: "image"; mediaId: string }
  | { type: "text"; text: string }
  | { type: "button"; id: string };

export async function handleIncomingMessage(from: string, message: IncomingMessage) {
  const usuario = await db.usuario.findFirst({ where: { telefonoWhatsapp: from, activo: true } });
  if (!usuario) {
    await sendText(from, "Este número no está registrado como empleado en ningún sistema. Contacta a tu administrador si crees que es un error.");
    return;
  }

  const conversacion = await db.conversacionWA.findUnique({ where: { usuarioId: usuario.id } });

  if (!conversacion) {
    if (message.type === "image") return startDraft(usuario.id, from, message.mediaId);
    await sendText(from, "Solo proceso fotos de boletas/facturas. Envía una foto clara del comprobante para registrar un gasto.");
    return;
  }

  const draft = conversacion.datos as unknown as Draft;

  if (conversacion.paso === "esperando_correccion_campo" && message.type === "text") {
    return applyCorrection(usuario.id, from, draft, message.text);
  }

  if (conversacion.paso === "esperando_confirmacion" && message.type === "button") {
    if (message.id === "confirmar") return askCategoria(usuario.id, from, draft);
    if (message.id === "corregir") return askQueCorregir(usuario.id, from, draft);
  }

  if (conversacion.paso === "esperando_campo_a_corregir" && message.type === "text") {
    const campo = matchCampo(message.text);
    if (!campo) {
      await sendText(from, "No reconocí ese campo. Escribe: monto, fecha, proveedor, ruc o comprobante.");
      return;
    }
    await db.conversacionWA.update({
      where: { usuarioId: usuario.id },
      data: { paso: "esperando_correccion_campo", datos: { ...draft, campoEnCorreccion: campo } as any },
    });
    await sendText(from, `Escribe ${CAMPO_LABELS[campo] ?? campo}:`);
    return;
  }

  if (conversacion.paso === "esperando_categoria" && message.type === "button") {
    if ((CATEGORIAS as readonly string[]).includes(message.id)) {
      return finalizeGasto(usuario, from, { ...draft, categoria: message.id });
    }
  }

  await sendText(from, "No entendí ese mensaje. Sigamos con el paso anterior, por favor responde usando los botones.");
}

async function startDraft(usuarioId: string, phone: string, mediaId: string) {
  const buffer = await downloadWhatsAppMedia(mediaId);
  const ocr = await readReceipt(buffer);

  if (!ocr.legible) {
    await sendText(phone, "No pude leer bien esa foto. ¿Puedes reenviarla con mejor luz/enfoque?");
    return;
  }

  const imagenUrl = await storeReceiptImage(buffer);

  const draft: Draft = {
    monto: ocr.monto,
    fecha: ocr.fecha,
    proveedor: ocr.proveedor,
    rucEmisor: ocr.rucEmisor,
    numeroComprobante: ocr.numeroComprobante,
    imagenUrl,
    camposPendientes: ocr.camposFaltantes,
  };

  await db.conversacionWA.upsert({
    where: { usuarioId },
    create: { usuarioId, paso: "esperando_confirmacion", datos: draft as any },
    update: { paso: "esperando_confirmacion", datos: draft as any },
  });

  if (draft.camposPendientes.length > 0) {
    return askQueCorregir(usuarioId, phone, draft, true);
  }

  await sendButtons(
    phone,
    `Leí esto: S/ ${draft.monto}, ${draft.fecha}, ${draft.proveedor}. ¿Es correcto?`,
    [
      { id: "confirmar", title: "Sí" },
      { id: "corregir", title: "Corregir" },
    ],
  );
}

async function askQueCorregir(usuarioId: string, phone: string, draft: Draft, primeraVez = false) {
  const pendientes = draft.camposPendientes.length > 0 ? draft.camposPendientes : Object.keys(CAMPO_LABELS);
  const primerCampo = pendientes[0];

  await db.conversacionWA.update({
    where: { usuarioId },
    data: { paso: "esperando_correccion_campo", datos: { ...draft, campoEnCorreccion: primerCampo } as any },
  });

  const intro = primeraVez
    ? "No pude leer todos los datos automáticamente. Vamos a completarlos juntos."
    : "Ok, vamos a corregir los datos.";
  await sendText(phone, `${intro} Escribe ${CAMPO_LABELS[primerCampo] ?? primerCampo}:`);
}

async function applyCorrection(usuarioId: string, phone: string, draft: Draft & { campoEnCorreccion?: string }, texto: string) {
  const campo = draft.campoEnCorreccion;
  if (!campo) return;

  const nuevoDraft: Draft = { ...draft };
  if (campo === "monto") nuevoDraft.monto = Number(texto.replace(",", "."));
  else (nuevoDraft as any)[campo] = texto.trim();

  nuevoDraft.camposPendientes = nuevoDraft.camposPendientes.filter((c) => c !== campo);
  delete (nuevoDraft as any).campoEnCorreccion;

  if (nuevoDraft.camposPendientes.length > 0) {
    await db.conversacionWA.update({
      where: { usuarioId },
      data: { datos: nuevoDraft as any },
    });
    return askQueCorregir(usuarioId, phone, nuevoDraft);
  }

  await db.conversacionWA.update({
    where: { usuarioId },
    data: { paso: "esperando_confirmacion", datos: nuevoDraft as any },
  });
  await sendButtons(
    phone,
    `Quedó así: S/ ${nuevoDraft.monto}, ${nuevoDraft.fecha}, ${nuevoDraft.proveedor}. ¿Es correcto?`,
    [
      { id: "confirmar", title: "Sí" },
      { id: "corregir", title: "Corregir otro dato" },
    ],
  );
}

async function askCategoria(usuarioId: string, phone: string, draft: Draft) {
  await db.conversacionWA.update({ where: { usuarioId }, data: { paso: "esperando_categoria", datos: draft as any } });
  await sendButtons(phone, "¿En qué categoría entra este gasto?", [
    { id: "movilidad", title: "Movilidad" },
    { id: "alimentacion", title: "Alimentación" },
    { id: "hospedaje", title: "Hospedaje" },
    { id: "otros", title: "Otros" },
  ]);
}

async function finalizeGasto(usuario: { id: string; empresaId: string | null; aprobadorId: string | null }, phone: string, draft: Draft) {
  // Checked here, against the final confirmed data, not right after OCR — the employee fills in
  // ruc/comprobante by hand whenever OCR can't read them, so checking pre-correction values would
  // silently skip this check for every manually-entered receipt.
  if (draft.rucEmisor && draft.numeroComprobante) {
    const duplicado = await db.gasto.findFirst({
      where: { empresaId: usuario.empresaId!, rucEmisor: draft.rucEmisor, numeroComprobante: draft.numeroComprobante },
    });
    if (duplicado) {
      await db.conversacionWA.delete({ where: { usuarioId: usuario.id } });
      await sendText(phone, "Esta boleta ya fue registrada antes en el sistema. No se creó un gasto nuevo.");
      return;
    }
  }

  const sunat = draft.rucEmisor ? await validarRuc(draft.rucEmisor) : { disponible: false };

  const gasto = await db.gasto.create({
    data: {
      empresaId: usuario.empresaId!,
      usuarioId: usuario.id,
      monto: draft.monto ?? 0,
      fechaGasto: parseFecha(draft.fecha),
      categoria: draft.categoria as any,
      rucEmisor: draft.rucEmisor,
      razonSocialEmisor: draft.proveedor,
      numeroComprobante: draft.numeroComprobante,
      imagenUrl: draft.imagenUrl!,
      estado: sunat.disponible ? "pendiente" : "pendiente_validacion",
      validadoSunat: sunat.disponible ? Boolean(sunat.activo) : false,
    },
  });

  await db.conversacionWA.delete({ where: { usuarioId: usuario.id } });

  let aprobadorNombre = "tu aprobador";
  if (usuario.aprobadorId) {
    const aprobador = await db.usuario.findUnique({ where: { id: usuario.aprobadorId } });
    if (aprobador) {
      aprobadorNombre = aprobador.nombre;
      await notificarAprobador(aprobador);
    }
  }

  await sendText(phone, `Gasto registrado, enviado a aprobación de ${aprobadorNombre}.`);
  void gasto;
}

async function notificarAprobador(aprobador: { id: string; telefonoWhatsapp: string | null }) {
  if (!aprobador.telefonoWhatsapp) return;
  const pendientes = await db.gasto.count({
    where: { usuario: { aprobadorId: aprobador.id }, estado: { in: ["pendiente", "pendiente_validacion"] } },
  });
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  await sendText(
    aprobador.telefonoWhatsapp,
    `Tienes ${pendientes} gasto(s) pendiente(s) de aprobación. Revísalos en ${frontendUrl}/aprobaciones`,
  );
}

function matchCampo(texto: string): string | null {
  const t = texto.toLowerCase();
  if (t.includes("monto")) return "monto";
  if (t.includes("fecha")) return "fecha";
  if (t.includes("proveedor") || t.includes("razon")) return "proveedor";
  if (t.includes("ruc")) return "rucEmisor";
  if (t.includes("comprobante") || t.includes("numero")) return "numeroComprobante";
  return null;
}

function parseFecha(fecha?: string): Date {
  if (!fecha) return new Date();
  const match = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return new Date();
  const [, dd, mm, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
}

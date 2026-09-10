import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, signPayload, verifyPayload } from "../auth.js";
import { toCsv } from "../csv.js";
import { readReceipt } from "../whatsapp/ocr.js";
import { storeReceiptImage } from "../whatsapp/media.js";
import { crearGasto, parseFecha, type UsuarioGasto } from "../gastos/crear.js";

export const gastosRouter = Router();

gastosRouter.use(requireAuth);

// En memoria: la imagen se va a Supabase Storage en el mismo request, no hace falta tocar disco
// (y en Render/Vercel el disco no persiste). El límite existe porque sin él cualquiera con una
// sesión válida puede llenar la memoria del proceso subiendo un archivo enorme.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CATEGORIA_POR_DEFECTO = "otros";

// La sesión de un empleado dura un año, así que el token puede seguir siendo válido mucho después
// de que la persona dejó la empresa. Acá es donde se corta: el rol y la empresa salen del token,
// pero que la cuenta siga activa se pregunta a la base en cada gasto.
async function usuarioActivo(userId: string): Promise<UsuarioGasto | null> {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: { id: true, empresaId: true, aprobadorId: true, activo: true },
  });
  if (!usuario || !usuario.activo || !usuario.empresaId) return null;
  return usuario;
}

function respuestaRegistrado(resultado: Extract<Awaited<ReturnType<typeof crearGasto>>, { ok: true }>) {
  return { estado: "registrado" as const, gastoId: resultado.gastoId, aprobador: resultado.aprobador?.nombre ?? null };
}

// Subir la foto es TODO lo que hace el empleado. Solo se le pregunta algo en el único caso en que
// el gasto no se puede registrar sin su ayuda: que no se haya podido leer el monto. Los demás
// datos que falten quedan en null y el gasto entra como pendiente_validacion para que los
// complete quien aprueba, que ya está mirando la boleta de todas formas.
gastosRouter.post("/", upload.single("foto"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Falta la foto de la boleta" });

  const usuario = await usuarioActivo(req.user!.id);
  if (!usuario) return res.status(403).json({ error: "Tu cuenta ya no está activa. Habla con tu administrador." });

  const ocr = await readReceipt(req.file.buffer);
  if (!ocr.legible) {
    return res.status(422).json({ estado: "ilegible", error: "No se pudo leer esa foto. Tómala de nuevo con más luz." });
  }

  const imagenUrl = await storeReceiptImage(req.file.buffer);
  const datosLeidos = {
    fecha: ocr.fecha,
    proveedor: ocr.proveedor,
    rucEmisor: ocr.rucEmisor,
    numeroComprobante: ocr.numeroComprobante,
    imagenUrl,
  };

  if (ocr.monto === undefined) {
    // La imagen ya está guardada; lo que vuelve al navegador va firmado para que el cliente no
    // pueda inventarse una imagenUrl ni cambiar lo que se leyó de la boleta al confirmar.
    return res.json({
      estado: "falta_monto",
      borrador: signPayload("borrador", { usuarioId: usuario.id, ...datosLeidos }, 30 * 60),
    });
  }

  const resultado = await crearGasto(usuario, {
    monto: ocr.monto,
    fecha: parseFecha(ocr.fecha),
    proveedor: ocr.proveedor,
    rucEmisor: ocr.rucEmisor,
    numeroComprobante: ocr.numeroComprobante,
    imagenUrl,
    categoria: CATEGORIA_POR_DEFECTO,
  });

  if (!resultado.ok) return res.status(409).json({ estado: "duplicado", error: "Esta boleta ya fue registrada antes." });
  res.status(201).json(respuestaRegistrado(resultado));
});

const borradorSchema = z.object({ borrador: z.string(), monto: z.number().positive() });

interface Borrador {
  usuarioId: string;
  fecha?: string;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  imagenUrl: string;
}

// Segundo paso, solo cuando no se pudo leer el monto: el empleado escribe la cifra y ya.
gastosRouter.post("/borrador", async (req, res) => {
  const parsed = borradorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Monto inválido" });

  const borrador = verifyPayload<Borrador>("borrador", parsed.data.borrador);
  if (!borrador) return res.status(400).json({ error: "El borrador venció. Vuelve a tomar la foto." });

  const usuario = await usuarioActivo(req.user!.id);
  if (!usuario) return res.status(403).json({ error: "Tu cuenta ya no está activa. Habla con tu administrador." });
  // Un borrador firmado sigue siendo válido para quien lo intercepte: sin esto, otra sesión
  // podría cargar el gasto de un compañero a su propio nombre.
  if (borrador.usuarioId !== usuario.id) return res.status(403).json({ error: "Ese borrador no es tuyo" });

  const resultado = await crearGasto(usuario, {
    monto: parsed.data.monto,
    fecha: parseFecha(borrador.fecha),
    proveedor: borrador.proveedor,
    rucEmisor: borrador.rucEmisor,
    numeroComprobante: borrador.numeroComprobante,
    imagenUrl: borrador.imagenUrl,
    categoria: CATEGORIA_POR_DEFECTO,
  });

  if (!resultado.ok) return res.status(409).json({ estado: "duplicado", error: "Esta boleta ya fue registrada antes." });
  res.status(201).json(respuestaRegistrado(resultado));
});

const listQuerySchema = z.object({
  estado: z.string().optional(),
  categoria: z.string().optional(),
  usuarioId: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

// Employees only ever see their own gastos; aprobadores see only the people who report to them;
// admins see the whole empresa. empresaId always comes from the session, never from the client.
function scopedWhere(user: NonNullable<Express.Request["user"]>, query: z.infer<typeof listQuerySchema>) {
  const where: Record<string, unknown> = { empresaId: user.empresaId! };
  if (user.rol === "empleado") where.usuarioId = user.id;
  if (user.rol === "aprobador") where.usuario = { aprobadorId: user.id };
  if (query.usuarioId && user.rol === "admin") where.usuarioId = query.usuarioId;
  if (query.estado) where.estado = query.estado;
  if (query.categoria) where.categoria = query.categoria;
  if (query.desde || query.hasta) {
    where.fechaGasto = {
      ...(query.desde ? { gte: new Date(query.desde) } : {}),
      ...(query.hasta ? { lte: new Date(query.hasta) } : {}),
    };
  }
  return where;
}

gastosRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const gastos = await db.gasto.findMany({
    where: scopedWhere(req.user!, parsed.data),
    orderBy: { fechaCreacion: "desc" },
    include: { usuario: { select: { nombre: true } } },
  });
  res.json(gastos);
});

gastosRouter.get("/export.csv", async (req, res) => {
  if (req.user!.rol === "empleado") return res.status(403).json({ error: "No autorizado" });

  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const gastos = await db.gasto.findMany({
    where: scopedWhere(req.user!, parsed.data),
    orderBy: { fechaGasto: "desc" },
    include: { usuario: { select: { nombre: true } } },
  });

  const csv = toCsv(gastos);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=gastos.csv");
  res.send(csv);
});

const decisionSchema = z.object({ decision: z.boolean(), comentario: z.string().optional() });

gastosRouter.post("/:id/decision", async (req, res) => {
  if (req.user!.rol !== "aprobador" && req.user!.rol !== "admin") {
    return res.status(403).json({ error: "No autorizado" });
  }

  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const gasto = await db.gasto.findFirst({
    where: { id: req.params.id, empresaId: req.user!.empresaId! },
    include: { usuario: true },
  });
  if (!gasto) return res.status(404).json({ error: "No encontrado" });

  if (req.user!.rol === "aprobador" && gasto.usuario.aprobadorId !== req.user!.id) {
    return res.status(403).json({ error: "Este gasto no te fue asignado" });
  }

  await db.$transaction([
    db.aprobacion.create({
      data: {
        gastoId: gasto.id,
        aprobadorId: req.user!.id,
        decision: parsed.data.decision,
        comentario: parsed.data.comentario,
      },
    }),
    db.gasto.update({
      where: { id: gasto.id },
      data: { estado: parsed.data.decision ? "aprobado" : "rechazado" },
    }),
  ]);

  res.json({ ok: true });
});

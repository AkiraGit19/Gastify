import { asyncRouter } from "../async-router.js";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, signPayload, verifyPayload } from "../auth.js";
import { toCsv } from "../csv.js";
import { readReceipt } from "../whatsapp/ocr.js";
import { storeReceiptImage } from "../whatsapp/media.js";
import { crearGasto, parseFecha, hashImagen, type UsuarioGasto } from "../gastos/crear.js";
import { inferirTipoComprobante, igvTrasEdicion } from "../gastos/comprobante.js";

export const gastosRouter = asyncRouter();

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

  // La huella se calcula sobre los bytes que subió el empleado, antes de guardarlos: es lo que
  // permite reconocer la misma foto aunque el OCR no haya leído nada útil de ella.
  const imagenHash = hashImagen(req.file.buffer);
  const imagenUrl = await storeReceiptImage(req.file.buffer);
  const datosLeidos = {
    fecha: ocr.fecha,
    proveedor: ocr.proveedor,
    rucEmisor: ocr.rucEmisor,
    numeroComprobante: ocr.numeroComprobante,
    igvLeido: ocr.igv,
    imagenUrl,
    imagenHash,
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
    igvLeido: ocr.igv,
    imagenUrl,
    imagenHash,
    categoria: CATEGORIA_POR_DEFECTO,
  });

  if (!resultado.ok) return res.status(409).json({ estado: "duplicado", error: resultado.detalle });
  res.status(201).json(respuestaRegistrado(resultado));
});

const borradorSchema = z.object({ borrador: z.string(), monto: z.number().positive() });

interface Borrador {
  usuarioId: string;
  fecha?: string;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  igvLeido?: number;
  imagenUrl: string;
  imagenHash: string;
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
    igvLeido: borrador.igvLeido,
    imagenUrl: borrador.imagenUrl,
    imagenHash: borrador.imagenHash,
    categoria: CATEGORIA_POR_DEFECTO,
  });

  if (!resultado.ok) return res.status(409).json({ estado: "duplicado", error: resultado.detalle });
  res.status(201).json(respuestaRegistrado(resultado));
});

const ESTADOS = ["pendiente", "pendiente_validacion", "aprobado", "pagado", "rechazado", "anulado"] as const;
const CATEGORIAS = ["movilidad", "alimentacion", "hospedaje", "otros"] as const;

// `estado` acepta varios separados por coma. La pantalla de aprobaciones necesita `pendiente` y
// `pendiente_validacion` a la vez, y hasta ahora resolvía eso bajándose la tabla entera de la
// empresa para filtrarla en el navegador: con unos miles de gastos, el celular de un aprobador
// descarga megabytes para mostrar doce filas.
//
// Los valores se validan contra el enum en vez de pasarlos crudos a Prisma: un estado inventado
// en la URL hacía fallar la consulta entera.
const listaSeparadaPorComas = <T extends readonly [string, ...string[]]>(valores: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(valores)).nonempty().optional());

const listQuerySchema = z.object({
  estado: listaSeparadaPorComas(ESTADOS),
  categoria: listaSeparadaPorComas(CATEGORIAS),
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
  if (query.estado) where.estado = { in: query.estado };
  if (query.categoria) where.categoria = { in: query.categoria };
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
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
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

// ---------------------------------------------------------------------------
// Corregir, anular y pagar.
//
// Hasta acá un gasto era inmutable: un monto mal leído quedaba en la contabilidad del cliente
// para siempre y lo único que podía hacer el aprobador era rechazarlo, que dejaba al empleado
// sin salida. Estas rutas son el camino de vuelta.
// ---------------------------------------------------------------------------

// Un gasto pagado ya se le reembolsó al empleado y uno anulado está fuera de juego: tocarlos
// desincronizaría la plata que salió de caja con lo que dice el sistema.
const ESTADOS_EDITABLES = ["pendiente", "pendiente_validacion", "rechazado", "aprobado"] as const;

const editarSchema = z.object({
  monto: z.number().positive().optional(),
  fechaGasto: z.string().optional(),
  categoria: z.enum(["movilidad", "alimentacion", "hospedaje", "otros"]).optional(),
  rucEmisor: z.string().nullable().optional(),
  razonSocialEmisor: z.string().nullable().optional(),
  numeroComprobante: z.string().nullable().optional(),
  // Decisiones contables: quién rinde no las toma, las toma quien revisa.
  tipoComprobante: z.enum(["factura", "boleta", "recibo_honorarios", "otro"]).optional(),
  igv: z.number().nonnegative().nullable().optional(),
});

const CAMPOS_CONTABLES = ["tipoComprobante", "igv"] as const;

type GastoConUsuario = Prisma.GastoGetPayload<{ include: { usuario: true } }>;

// Quién puede tocar qué. El empleado corrige lo suyo mientras no esté aprobado —incluido un
// gasto rechazado, que es justamente el caso donde necesita corregir y reenviar—. El aprobador
// arregla lo que está por revisar. El admin ve toda la empresa.
function puedeEditar(user: NonNullable<Express.Request["user"]>, gasto: GastoConUsuario): string | null {
  if (!(ESTADOS_EDITABLES as readonly string[]).includes(gasto.estado)) {
    return gasto.estado === "pagado"
      ? "Este gasto ya fue pagado y no se puede modificar."
      : "Este gasto está anulado.";
  }
  if (user.rol === "admin") return null;
  if (user.rol === "aprobador") {
    if (gasto.usuario.aprobadorId !== user.id) return "Este gasto no te fue asignado";
    if (gasto.estado === "aprobado") return "Ya decidiste sobre este gasto.";
    return null;
  }
  if (user.rol === "empleado") {
    if (gasto.usuarioId !== user.id) return "Este gasto no es tuyo";
    if (gasto.estado === "aprobado") return "Este gasto ya fue aprobado y no se puede modificar.";
    return null;
  }
  return "No autorizado";
}

gastosRouter.patch("/:id", async (req, res) => {
  const parsed = editarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const gasto = await db.gasto.findFirst({
    where: { id: req.params.id, empresaId: req.user!.empresaId! },
    include: { usuario: true },
  });
  if (!gasto) return res.status(404).json({ error: "No encontrado" });

  const impedimento = puedeEditar(req.user!, gasto);
  if (impedimento) return res.status(403).json({ error: impedimento });

  const tocaContables = CAMPOS_CONTABLES.some((c) => parsed.data[c] !== undefined);
  if (tocaContables && req.user!.rol === "empleado") {
    return res.status(403).json({ error: "El tipo de comprobante y el IGV los define quien revisa el gasto." });
  }

  const cambios: Prisma.GastoUpdateInput = {};
  const { fechaGasto, ...resto } = parsed.data;
  Object.assign(cambios, resto);
  if (fechaGasto !== undefined) cambios.fechaGasto = parseFecha(fechaGasto);

  // Si cambia el número de comprobante y nadie fijó el tipo a mano, se vuelve a inferir: de nada
  // sirve corregir "B001-5" a "F001-5" si el gasto sigue clasificado como boleta y sin IGV.
  const numeroFinal = parsed.data.numeroComprobante !== undefined ? parsed.data.numeroComprobante : gasto.numeroComprobante;
  const tipoFinal = parsed.data.tipoComprobante ?? (parsed.data.numeroComprobante !== undefined ? inferirTipoComprobante(numeroFinal) : gasto.tipoComprobante);
  if (tipoFinal !== gasto.tipoComprobante) cambios.tipoComprobante = tipoFinal;

  const montoFinal = parsed.data.monto ?? Number(gasto.monto);
  const igvFinal = igvTrasEdicion(
    { monto: Number(gasto.monto), tipoComprobante: gasto.tipoComprobante, igv: gasto.igv === null ? null : Number(gasto.igv) },
    montoFinal,
    tipoFinal,
    parsed.data.igv,
  );
  if (igvFinal !== (gasto.igv === null ? null : Number(gasto.igv))) cambios.igv = igvFinal;

  const camposCambiados = Object.keys(cambios).filter((campo) => {
    const anterior = (gasto as Record<string, unknown>)[campo];
    const nuevo = (cambios as Record<string, unknown>)[campo];
    return textoDe(anterior) !== textoDe(nuevo);
  });
  if (camposCambiados.length === 0) return res.json(gasto);

  // El gasto y su rastro se guardan juntos: si la auditoría se escribiera aparte y fallara,
  // quedaría un monto cambiado sin constancia de quién lo cambió.
  try {
    const [actualizado] = await db.$transaction([
      db.gasto.update({ where: { id: gasto.id }, data: cambios, include: { usuario: { select: { nombre: true } } } }),
      db.edicionGasto.createMany({
        data: camposCambiados.map((campo) => ({
          gastoId: gasto.id,
          usuarioId: req.user!.id,
          campo,
          valorAnterior: textoDe((gasto as Record<string, unknown>)[campo]),
          valorNuevo: textoDe((cambios as Record<string, unknown>)[campo]),
        })),
      }),
    ]);
    res.json(actualizado);
  } catch (err) {
    // Corregir un comprobante hacia uno que ya existe choca contra el índice único. Es un error
    // del usuario, no del sistema: se le dice cuál es el problema en vez de devolver un 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Ya hay otro gasto con ese RUC y número de comprobante." });
    }
    throw err;
  }
});

function textoDe(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor);
}

const anularSchema = z.object({ motivo: z.string().min(3, "Explica por qué se anula") });

// Anular, no borrar. Un gasto borrado deja un hueco que nadie puede explicar seis meses después;
// uno anulado con motivo es una respuesta.
gastosRouter.post("/:id/anular", async (req, res) => {
  if (req.user!.rol !== "admin") return res.status(403).json({ error: "Solo un administrador puede anular gastos" });

  const parsed = anularSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Indica el motivo de la anulación" });

  const gasto = await db.gasto.findFirst({ where: { id: req.params.id, empresaId: req.user!.empresaId! } });
  if (!gasto) return res.status(404).json({ error: "No encontrado" });
  if (gasto.estado === "anulado") return res.status(400).json({ error: "Ya está anulado" });
  if (gasto.estado === "pagado") return res.status(400).json({ error: "Este gasto ya fue pagado. Anularlo no devuelve la plata: regístralo como corresponda con tu contador." });

  const [actualizado] = await db.$transaction([
    db.gasto.update({ where: { id: gasto.id }, data: { estado: "anulado", motivoAnulacion: parsed.data.motivo } }),
    db.edicionGasto.create({
      data: { gastoId: gasto.id, usuarioId: req.user!.id, campo: "estado", valorAnterior: gasto.estado, valorNuevo: "anulado" },
    }),
  ]);

  res.json(actualizado);
});

const pagarSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });

// Cierra el ciclo. Hasta acá el flujo moría en "aprobado" y el empleado no tenía forma de saber
// si le habían devuelto la plata. Va en lote porque los reembolsos se hacen en lote.
gastosRouter.post("/pagar", async (req, res) => {
  if (req.user!.rol !== "admin") return res.status(403).json({ error: "Solo un administrador registra los pagos" });

  const parsed = pagarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Indica qué gastos se pagaron" });

  // Solo pasan los aprobados de la propia empresa. Lo que no califique se informa en vez de
  // fallar entero: marcar 40 reembolsos y que se caigan los 40 por uno malo no ayuda a nadie.
  const elegibles = await db.gasto.findMany({
    where: { id: { in: parsed.data.ids }, empresaId: req.user!.empresaId!, estado: "aprobado" },
    select: { id: true },
  });
  const ids = elegibles.map((g) => g.id);

  if (ids.length > 0) {
    await db.$transaction([
      db.gasto.updateMany({ where: { id: { in: ids } }, data: { estado: "pagado", fechaPago: new Date() } }),
      db.edicionGasto.createMany({
        data: ids.map((gastoId) => ({ gastoId, usuarioId: req.user!.id, campo: "estado", valorAnterior: "aprobado", valorNuevo: "pagado" })),
      }),
    ]);
  }

  res.json({ pagados: ids.length, omitidos: parsed.data.ids.length - ids.length });
});

// Va al final a propósito: declarado antes, este ":id" se tragaría GET /gastos/export.csv.
gastosRouter.get("/:id", async (req, res) => {
  const gasto = await db.gasto.findFirst({
    where: { id: req.params.id, ...scopedWhere(req.user!, {}) },
    include: {
      usuario: { select: { nombre: true } },
      ediciones: { orderBy: { fecha: "desc" }, include: { usuario: { select: { nombre: true } } } },
      aprobaciones: { orderBy: { fechaDecision: "desc" }, include: { aprobador: { select: { nombre: true } } } },
    },
  });
  if (!gasto) return res.status(404).json({ error: "No encontrado" });
  res.json(gasto);
});

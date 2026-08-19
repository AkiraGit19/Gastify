import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { toCsv } from "../csv.js";

export const gastosRouter = Router();

gastosRouter.use(requireAuth);

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

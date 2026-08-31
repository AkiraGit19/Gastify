import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const usuariosRouter = Router();

usuariosRouter.use(requireAuth, requireRole("admin"));

// req.user.empresaId is the ONLY source of tenant scope here — never taken from the request body/query.
usuariosRouter.get("/", async (req, res) => {
  const usuarios = await db.usuario.findMany({
    where: { empresaId: req.user!.empresaId! },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefonoWhatsapp: true,
      rol: true,
      activo: true,
      aprobadorId: true,
    },
  });
  res.json(usuarios);
});

const createSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  telefonoWhatsapp: z.string().min(8),
  rol: z.enum(["empleado", "aprobador"]),
  aprobadorId: z.string().optional(),
});

usuariosRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const empresaId = req.user!.empresaId!;

  if (parsed.data.aprobadorId) {
    const aprobador = await db.usuario.findFirst({
      where: { id: parsed.data.aprobadorId, empresaId },
    });
    if (!aprobador) return res.status(400).json({ error: "Aprobador inválido" });
  }

  const usuario = await db.usuario.create({ data: { ...parsed.data, empresaId } });
  res.status(201).json(usuario);
});

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["empleado", "aprobador"]).optional(),
  aprobadorId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

usuariosRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const empresaId = req.user!.empresaId!;
  const existing = await db.usuario.findFirst({ where: { id: req.params.id, empresaId } });
  if (!existing) return res.status(404).json({ error: "No encontrado" });

  // Without this, the only admin of a company could deactivate their own account and lock
  // everyone out — there's no other way back in since roles can only be changed by an admin.
  if (existing.id === req.user!.id && parsed.data.activo === false) {
    return res.status(400).json({ error: "No puedes dar de baja tu propia cuenta" });
  }

  if (parsed.data.aprobadorId) {
    const aprobador = await db.usuario.findFirst({ where: { id: parsed.data.aprobadorId, empresaId } });
    if (!aprobador) return res.status(400).json({ error: "Aprobador inválido" });
  }

  const usuario = await db.usuario.update({ where: { id: existing.id }, data: parsed.data });
  res.json(usuario);
});

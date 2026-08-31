import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole, hashPassword, verifyPassword } from "../auth.js";

export const usuariosRouter = Router();

const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  telefonoWhatsapp: true,
  rol: true,
  activo: true,
  aprobadorId: true,
} as const;

const meSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    telefonoWhatsapp: z.string().min(8).nullable().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((d) => !d.newPassword || d.currentPassword, {
    message: "Debes indicar tu contraseña actual para cambiarla",
    path: ["currentPassword"],
  });

// Any authenticated role can read/edit their own name and phone — scoped to req.user.id, never
// a param, so there's no way to reach another user's row through this endpoint.
usuariosRouter.get("/me", requireAuth, async (req, res) => {
  const usuario = await db.usuario.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, nombre: true, email: true, telefonoWhatsapp: true, rol: true },
  });
  res.json(usuario);
});

usuariosRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = meSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { currentPassword, newPassword, ...rest } = parsed.data;
  const data: Prisma.UsuarioUpdateInput = { ...rest };

  if (newPassword) {
    const usuario = await db.usuario.findUniqueOrThrow({ where: { id: req.user!.id } });
    const valido = await verifyPassword(currentPassword!, usuario.passwordHash);
    if (!valido) return res.status(400).json({ error: "Contraseña actual incorrecta" });
    data.passwordHash = await hashPassword(newPassword);
  }

  try {
    const usuario = await db.usuario.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, nombre: true, email: true, telefonoWhatsapp: true, rol: true },
    });
    res.json(usuario);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ese número de WhatsApp ya está en uso" });
    }
    throw err;
  }
});

usuariosRouter.use(requireAuth, requireRole("admin"));

// req.user.empresaId is the ONLY source of tenant scope here — never taken from the request body/query.
usuariosRouter.get("/", async (req, res) => {
  const usuarios = await db.usuario.findMany({
    where: { empresaId: req.user!.empresaId! },
    orderBy: { nombre: "asc" },
    select: SELECT_PUBLICO,
  });
  res.json(usuarios);
});

const createSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  telefonoWhatsapp: z.string().min(8),
  rol: z.enum(["empleado", "aprobador"]),
  aprobadorId: z.string().optional(),
  password: z.string().min(8),
});

usuariosRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const empresaId = req.user!.empresaId!;
  const { password, ...rest } = parsed.data;

  if (rest.aprobadorId) {
    const aprobador = await db.usuario.findFirst({
      where: { id: rest.aprobadorId, empresaId },
    });
    if (!aprobador) return res.status(400).json({ error: "Aprobador inválido" });
  }

  const passwordHash = await hashPassword(password);
  const usuario = await db.usuario.create({
    data: { ...rest, empresaId, passwordHash },
    select: SELECT_PUBLICO,
  });
  res.status(201).json(usuario);
});

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["empleado", "aprobador"]).optional(),
  aprobadorId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).optional(),
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

  // This route resets a *teammate's* password with no current-password check — that's fine when
  // it's someone else's account, but for your own account it would let a hijacked/stolen session
  // token silently take over the account by setting a new password with no re-authentication.
  // Self password changes must go through PATCH /usuarios/me, which requires currentPassword.
  if (existing.id === req.user!.id && parsed.data.password) {
    return res.status(400).json({ error: "Para cambiar tu propia contraseña usa Mi perfil, no esta pantalla" });
  }

  if (parsed.data.aprobadorId) {
    const aprobador = await db.usuario.findFirst({ where: { id: parsed.data.aprobadorId, empresaId } });
    if (!aprobador) return res.status(400).json({ error: "Aprobador inválido" });
  }

  const { password, ...rest } = parsed.data;
  const data: Prisma.UsuarioUpdateInput = { ...rest };
  // Admin resets a teammate's password directly (no email flow) — this is how a locked-out
  // employee gets back in, since there's no self-service "forgot password" in v1.
  if (password) data.passwordHash = await hashPassword(password);

  const usuario = await db.usuario.update({ where: { id: existing.id }, data, select: SELECT_PUBLICO });
  res.json(usuario);
});

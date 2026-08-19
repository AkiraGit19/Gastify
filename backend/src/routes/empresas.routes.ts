import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { createMagicLink } from "../auth.js";
import { sendMagicLinkEmail } from "../email.js";

export const empresasRouter = Router();

empresasRouter.use(requireAuth, requireRole("super_admin"));

empresasRouter.get("/", async (_req, res) => {
  const empresas = await db.empresa.findMany({
    orderBy: { fechaAlta: "desc" },
    include: { _count: { select: { usuarios: true, gastos: true } } },
  });
  res.json(empresas);
});

const createSchema = z.object({
  razonSocial: z.string().min(1),
  ruc: z.string().min(8),
  adminNombre: z.string().min(1),
  adminEmail: z.string().email(),
});

empresasRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { razonSocial, ruc, adminNombre, adminEmail } = parsed.data;

  const empresa = await db.empresa.create({
    data: {
      razonSocial,
      ruc,
      usuarios: {
        create: { nombre: adminNombre, email: adminEmail, rol: "admin" },
      },
    },
    include: { usuarios: true },
  });

  const admin = empresa.usuarios[0];
  const token = await createMagicLink(admin.id);
  await sendMagicLinkEmail(admin.email, token);

  res.status(201).json(empresa);
});

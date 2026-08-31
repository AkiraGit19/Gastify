import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole, hashPassword } from "../auth.js";

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
  adminPassword: z.string().min(8),
});

empresasRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { razonSocial, ruc, adminNombre, adminEmail, adminPassword } = parsed.data;
  const passwordHash = await hashPassword(adminPassword);

  const empresa = await db.empresa.create({
    data: {
      razonSocial,
      ruc,
      usuarios: {
        create: { nombre: adminNombre, email: adminEmail, rol: "admin", passwordHash },
      },
    },
    include: { usuarios: { select: { id: true, nombre: true, email: true, rol: true } } },
  });

  res.status(201).json(empresa);
});

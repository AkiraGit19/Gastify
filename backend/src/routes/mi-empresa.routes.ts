import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const miEmpresaRouter = Router();

// Distinct from empresasRouter (super_admin, sees every company) — this is scoped to the admin's
// own empresaId only, taken from the session, never a param.
miEmpresaRouter.use(requireAuth, requireRole("admin"));

miEmpresaRouter.get("/", async (req, res) => {
  const empresa = await db.empresa.findUniqueOrThrow({ where: { id: req.user!.empresaId! } });
  res.json(empresa);
});

const updateSchema = z.object({
  razonSocial: z.string().min(1).optional(),
  ruc: z.string().min(8).optional(),
});

miEmpresaRouter.patch("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const empresa = await db.empresa.update({
      where: { id: req.user!.empresaId! },
      data: parsed.data,
    });
    res.json(empresa);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ese RUC ya está registrado" });
    }
    throw err;
  }
});

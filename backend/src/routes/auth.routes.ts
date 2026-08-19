import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { createMagicLink, consumeMagicLink, signSession } from "../auth.js";
import { sendMagicLinkEmail } from "../email.js";

export const authRouter = Router();

const requestSchema = z.object({ email: z.string().email() });

authRouter.post("/magic-link", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email inválido" });

  // Always respond the same way whether or not the email is registered — otherwise this endpoint
  // becomes a free way to enumerate every employee's email address at a company.
  const usuario = await db.usuario.findUnique({ where: { email: parsed.data.email } });
  if (usuario?.activo) {
    const token = await createMagicLink(usuario.id);
    await sendMagicLinkEmail(usuario.email, token);
  }
  res.json({ ok: true });
});

const verifySchema = z.object({ token: z.string() });

authRouter.post("/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Token inválido" });

  const session = await consumeMagicLink(parsed.data.token);
  if (!session) return res.status(401).json({ error: "Enlace inválido o expirado" });

  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: session.id } });
  const jwt = signSession(session);
  res.json({
    token: jwt,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      empresaId: usuario.empresaId,
    },
  });
});

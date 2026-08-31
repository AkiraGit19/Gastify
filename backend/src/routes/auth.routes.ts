import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { verifyPassword, signSession } from "../auth.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  // Same generic error whether the email doesn't exist or the password is wrong — otherwise this
  // endpoint becomes a way to enumerate which emails are registered.
  const invalido = () => res.status(401).json({ error: "Email o contraseña incorrectos" });

  const usuario = await db.usuario.findUnique({ where: { email: parsed.data.email } });
  if (!usuario || !usuario.activo) return invalido();

  const valido = await verifyPassword(parsed.data.password, usuario.passwordHash);
  if (!valido) return invalido();

  const session = { id: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId };
  const token = signSession(session);
  res.json({
    token,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      empresaId: usuario.empresaId,
    },
  });
});

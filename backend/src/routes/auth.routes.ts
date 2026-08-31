import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { verifyPassword, signSession } from "../auth.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Bcrypt hash of a random unguessable value — no real password ever equals it. Used only to give
// a nonexistent email the same bcrypt.compare cost as a real one, see comment below.
const DUMMY_HASH = "$2a$12$CwE9k3qz2gk5.RxUuJH64OW9rF6nGxwybZ4pQ2eB3qy5Qh8FVvJHi";

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  // Same generic error whether the email doesn't exist or the password is wrong — otherwise this
  // endpoint becomes a way to enumerate which emails are registered.
  const invalido = () => res.status(401).json({ error: "Email o contraseña incorrectos" });

  const usuario = await db.usuario.findUnique({ where: { email: parsed.data.email } });

  // Always run bcrypt.compare, even for a nonexistent/inactive account, against a dummy hash of
  // the same cost — otherwise a missing user short-circuits and responds measurably faster than a
  // wrong password, and the timing difference alone reveals which emails are registered.
  const valido = await verifyPassword(parsed.data.password, usuario?.passwordHash ?? DUMMY_HASH);
  if (!usuario || !usuario.activo || !valido) return invalido();

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

import { asyncRouter } from "../async-router.js";
import { z } from "zod";
import { db } from "../db.js";
import { verifyPassword, signSession, hashPassword, verifyPayload } from "../auth.js";

export const authRouter = asyncRouter();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Bcrypt hash of a random unguessable value — no real password ever equals it. Used only to give
// a nonexistent email the same bcrypt.compare cost as a real one, see comment below.
const DUMMY_HASH = "$2a$12$CwE9k3qz2gk5.RxUuJH64OW9rF6nGxwybZ4pQ2eB3qy5Qh8FVvJHi";

// Tras este número de fallos la cuenta descansa. El bloqueo es temporal a propósito: uno
// permanente convierte el login en una forma de dejar fuera a un compañero sabiendo su correo.
const MAX_INTENTOS = 8;
const BLOQUEO_MINUTOS = 15;

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

  const bloqueado = Boolean(usuario?.bloqueadoHasta && usuario.bloqueadoHasta > new Date());

  if (bloqueado) {
    // El aviso de "está bloqueada" solo se da a quien acertó la contraseña, porque ya demostró
    // que la cuenta es suya. Con la contraseña equivocada se responde lo mismo que siempre, así
    // el bloqueo no se convierte en una forma de averiguar qué correos existen.
    if (valido) {
      const minutos = Math.ceil((usuario!.bloqueadoHasta!.getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: `Demasiados intentos fallidos. Vuelve a intentar en ${minutos} minuto(s).` });
    }
    return invalido();
  }

  if (!usuario || !usuario.activo || !valido) {
    if (usuario) {
      const intentos = usuario.intentosFallidos + 1;
      await db.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: intentos,
          bloqueadoHasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) : null,
        },
      });
    }
    return invalido();
  }

  // Entrar bien borra la cuenta pendiente: los fallos que importan son los seguidos.
  if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
    await db.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
  }

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

const invitacionSchema = z.object({ token: z.string(), password: z.string().min(8) });

interface Invitacion {
  usuarioId: string;
  huella: string;
}

// Canjea el link de invitación: el empleado elige su contraseña y queda dentro, sin pasar por
// la pantalla de login. Es público a propósito — quien llega acá todavía no tiene sesión.
authRouter.post("/invitacion", async (req, res) => {
  const parsed = invitacionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });

  const invalido = () => res.status(400).json({ error: "Este link ya se usó o venció. Pídele uno nuevo a tu administrador." });

  const invitacion = verifyPayload<Invitacion>("invitacion", parsed.data.token);
  if (!invitacion) return invalido();

  const usuario = await db.usuario.findUnique({ where: { id: invitacion.usuarioId } });
  // La huella es del hash que la cuenta tenía cuando se generó el link. Si ya no coincide es que
  // la contraseña cambió — el link se usó, o el admin la reseteó — y este deja de servir.
  if (!usuario || !usuario.activo || usuario.passwordHash.slice(-16) !== invitacion.huella) return invalido();

  await db.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await hashPassword(parsed.data.password), intentosFallidos: 0, bloqueadoHasta: null },
  });

  const session = { id: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId };
  res.json({
    token: signSession(session),
    user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, empresaId: usuario.empresaId },
  });
});

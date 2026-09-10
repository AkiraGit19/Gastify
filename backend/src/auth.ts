import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { Rol } from "@prisma/client";

// A hardcoded fallback here would mean anyone reading this public repo could forge a super_admin JWT.
function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET no está configurado. Defínelo como variable de entorno antes de arrancar el servidor.");
  return value;
}

const JWT_SECRET = requireJwtSecret();
const BCRYPT_ROUNDS = 12;

export interface SessionUser {
  id: string;
  rol: Rol;
  empresaId: string | null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signSession(user: SessionUser) {
  // El empleado entra tocando el ícono en su pantalla de inicio y no vuelve a ver un login.
  // Con 7 días quedaría afuera cada semana, que es exactamente la fricción que el panel viene a
  // eliminar. La contrapartida —un token largo no se puede revocar— se cubre comprobando que la
  // cuenta siga activa al registrar el gasto (ver POST /gastos), no alargando menos el token.
  return jwt.sign(user, JWT_SECRET, { expiresIn: user.rol === "empleado" ? "365d" : "7d" });
}

// Payloads firmados que NO son sesiones: un borrador de gasto que vuelve del navegador, o un
// link de invitación. El campo `proposito` es lo que impide que un token de un tipo sirva para
// el otro; un token de sesión no lo lleva, así que tampoco pasa por acá.
type Proposito = "borrador" | "invitacion";

export function signPayload(proposito: Proposito, data: object, expiraEnSegundos: number) {
  return jwt.sign({ ...data, proposito }, JWT_SECRET, { expiresIn: expiraEnSegundos });
}

export function verifyPayload<T>(proposito: Proposito, token: string): T | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    if (decoded.proposito !== proposito) return null;
    return decoded as T;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    req.user = jwt.verify(token, JWT_SECRET) as SessionUser;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}

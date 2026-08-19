import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import type { Rol } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const MAGIC_LINK_TTL_MINUTES = 15;

export interface SessionUser {
  id: string;
  rol: Rol;
  empresaId: string | null;
}

export async function createMagicLink(usuarioId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000);
  await db.magicLink.create({ data: { usuarioId, token, expiraEn } });
  return token;
}

export async function consumeMagicLink(token: string): Promise<SessionUser | null> {
  const link = await db.magicLink.findUnique({ where: { token }, include: { usuario: true } });
  if (!link || link.usado || link.expiraEn < new Date()) return null;

  await db.magicLink.update({ where: { id: link.id }, data: { usado: true } });
  return { id: link.usuario.id, rol: link.usuario.rol, empresaId: link.usuario.empresaId };
}

export function signSession(user: SessionUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
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

import { signPayload } from "./auth.js";

const DIAS_VIGENCIA = 7;

// Un link de acceso vale por una sola vez: lleva la cola del hash de contraseña actual, así que
// en cuanto alguien lo usa y fija una contraseña nueva, la huella deja de coincidir y el link
// muere. Sin columnas extra ni tabla de tokens.
export function crearLinkInvitacion(usuario: { id: string; passwordHash: string }) {
  const token = signPayload(
    "invitacion",
    { usuarioId: usuario.id, huella: usuario.passwordHash.slice(-16) },
    DIAS_VIGENCIA * 24 * 60 * 60,
  );
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return { url: `${frontendUrl}/invitacion?token=${encodeURIComponent(token)}`, expiraEnDias: DIAS_VIGENCIA };
}

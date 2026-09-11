import crypto from "node:crypto";
import { db } from "./db.js";

// Un stack completo puede ser enorme y las primeras líneas son las que dicen algo. El recorte
// también evita que un error con datos adentro llene la base.
const MAX_STACK = 2000;

export async function registrarError(err: unknown, ruta: string, metodo: string) {
  const mensaje = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, MAX_STACK) : null;
  const huella = crypto.createHash("sha256").update(`${mensaje}|${ruta}|${metodo}`).digest("hex");

  try {
    await db.errorRegistrado.upsert({
      where: { huella },
      create: { huella, mensaje, ruta, metodo, stack },
      // El mismo fallo repetido suma al contador en vez de crear otra fila: durante una caída,
      // lo que interesa es "esto pasó 4.000 veces", no cuatro mil filas iguales.
      update: { conteo: { increment: 1 }, ultimaVez: new Date(), stack },
    });
  } catch (fallo) {
    // Si la base es justamente lo que está fallando, el registro no puede tapar el error original
    // ni tumbar la respuesta. Queda el log de la plataforma como último recurso.
    console.error("[monitoreo] no se pudo registrar el error:", fallo);
  }
}

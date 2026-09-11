import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = "boletas";
const UPLOADS_DIR = path.resolve(import.meta.dirname, "../../uploads");
const TEST_MEDIA_DIR = path.resolve(import.meta.dirname, "../../test-media");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

// Vercel y Render definen estas variables solos; NODE_ENV cubre cualquier otro hosting.
const EN_PRODUCCION = Boolean(process.env.VERCEL || process.env.RENDER || process.env.NODE_ENV === "production");

// Sin Supabase, las boletas se guardan en el disco del contenedor — que en Vercel y en el plan
// gratis de Render se borra en cada despliegue. Eso no es una degradación aceptable: la foto es
// el sustento del gasto ante SUNAT, así que perderla deja registros de dinero sin respaldo, y
// nadie se entera hasta que un contador pide ver un comprobante de hace tres meses.
//
// Por eso en producción esto revienta al arrancar en vez de funcionar a medias: el mismo criterio
// que JWT_SECRET en auth.ts. Un despliegue que no arranca se nota; uno que borra fotos en silencio, no.
if (EN_PRODUCCION && !(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error(
    "Falta configurar Supabase Storage (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY). " +
      "Sin eso las fotos de las boletas se guardarían en disco efímero y se perderían en el próximo despliegue.",
  );
}

if (!EN_PRODUCCION && !(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)) {
  console.warn("[storage] Sin Supabase configurado: las boletas van a backend/uploads/. Sirve para desarrollo, nunca para producción.");
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  if (!WHATSAPP_API_TOKEN) {
    // ponytail: no Meta credentials yet — read a local test image instead of calling graph.facebook.com.
    // Send a fake webhook with image.id = filename under backend/test-media/. Real WhatsApp media ids
    // are opaque numeric strings, never filenames, so this path is dead once WHATSAPP_API_TOKEN is set.
    // mediaId comes straight off the webhook body, so it's treated as attacker-controlled here even
    // in dev — reject anything but a plain filename before it touches the filesystem.
    if (!/^[A-Za-z0-9_.-]+$/.test(mediaId)) throw new Error("mediaId inválido");
    const resolved = path.resolve(TEST_MEDIA_DIR, mediaId);
    if (!resolved.startsWith(TEST_MEDIA_DIR + path.sep)) throw new Error("mediaId inválido");
    return fs.readFile(resolved);
  }

  const metaResp = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
  });
  const meta = (await metaResp.json()) as { url: string };

  const fileResp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
  });
  return Buffer.from(await fileResp.arrayBuffer());
}

export async function storeReceiptImage(buffer: Buffer): Promise<string> {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const filename = `${crypto.randomUUID()}.jpg`;
    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filename}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
      },
      body: new Uint8Array(buffer),
    });
    if (!resp.ok) throw new Error(`No se pudo subir la imagen a Supabase Storage: ${await resp.text()}`);
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filename}`;
  }

  // ponytail: dev fallback, no Supabase Storage configured — write to local disk served by /uploads.
  // Not appropriate for production (Render's free tier has no persistent disk), only for local dev.
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `${PUBLIC_BASE_URL}/uploads/${filename}`;
}

// Borra una imagen ya guardada. Se usa cuando el gasto no llegó a crearse: la foto se sube antes
// de saber si el comprobante está duplicado, así que sin esto cada intento rechazado dejaría un
// archivo que nadie referencia, ocupando espacio del cliente para siempre.
//
// Nunca lanza: si la foto no se pudo borrar, el problema es un archivo de más, y hacer fallar por
// eso una petición que ya se resolvió sería cambiar un desperdicio por un error de cara al usuario.
export async function deleteReceiptImage(imagenUrl: string): Promise<void> {
  try {
    const nombre = imagenUrl.split(`/${SUPABASE_BUCKET}/`)[1];
    if (nombre && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nombre}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      return;
    }
    const local = imagenUrl.split("/uploads/")[1];
    if (local) await fs.rm(path.join(UPLOADS_DIR, local), { force: true });
  } catch (err) {
    console.error("[storage] no se pudo borrar una imagen huérfana:", err);
  }
}

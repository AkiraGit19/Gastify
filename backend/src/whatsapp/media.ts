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

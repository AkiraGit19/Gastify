import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const UPLOADS_DIR = path.resolve(import.meta.dirname, "../../uploads");
const TEST_MEDIA_DIR = path.resolve(import.meta.dirname, "../../test-media");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

if (CLOUDINARY_URL) cloudinary.config({ secure: true });

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
  if (CLOUDINARY_URL) {
    const upload = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "gastify/boletas" }, (err, result) => {
          if (err || !result) reject(err);
          else resolve(result);
        })
        .end(buffer);
    });
    return upload.secure_url;
  }

  // ponytail: dev fallback, no Cloudinary configured — write to local disk served by /uploads.
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `${PUBLIC_BASE_URL}/uploads/${filename}`;
}

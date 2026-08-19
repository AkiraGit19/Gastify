import crypto from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { handleIncomingMessage } from "../whatsapp/bot.js";

export const whatsappRouter = Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "dev-verify-token";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Meta signs every webhook POST with HMAC-SHA256 over the raw body, using the app secret.
// Without checking this, anyone who finds the webhook URL can pretend to be any employee's phone
// number and drive the bot (create fake gastos, etc). ponytail: no secret configured yet (no Meta
// account) -> warn and allow through, since this path is unreachable in dev anyway; reject once configured.
function verifyMetaSignature(req: Request, res: Response, next: NextFunction) {
  if (!APP_SECRET) {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET no configurado — firma de Meta sin verificar (solo válido en desarrollo)");
    return next();
  }

  const signature = req.header("x-hub-signature-256");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) return res.sendStatus(401);

  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return res.sendStatus(401);
  }
  next();
}

whatsappRouter.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          from: string;
          type: string;
          text?: { body: string };
          image?: { id: string };
          interactive?: { button_reply?: { id: string } };
        }[];
      };
    }[];
  }[];
}

whatsappRouter.post("/webhook", verifyMetaSignature, async (req, res) => {
  // Meta expects a fast 200 regardless of processing outcome, or it will retry aggressively.
  res.sendStatus(200);

  const body = req.body as WhatsAppWebhookBody;
  const messages = body.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

  for (const msg of messages) {
    try {
      if (msg.type === "image" && msg.image) {
        await handleIncomingMessage(msg.from, { type: "image", mediaId: msg.image.id });
      } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
        await handleIncomingMessage(msg.from, { type: "button", id: msg.interactive.button_reply.id });
      } else if (msg.type === "text" && msg.text) {
        await handleIncomingMessage(msg.from, { type: "text", text: msg.text.body });
      }
    } catch (err) {
      console.error("Error procesando mensaje de WhatsApp:", err);
    }
  }
});

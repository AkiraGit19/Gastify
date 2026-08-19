import { Router } from "express";
import { handleIncomingMessage } from "../whatsapp/bot.js";

export const whatsappRouter = Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "dev-verify-token";

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

whatsappRouter.post("/webhook", async (req, res) => {
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

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function callGraphApi(payload: Record<string, unknown>) {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    // ponytail: no Meta credentials yet — log what would have been sent instead of failing the flow.
    console.log("[whatsapp:out]", JSON.stringify(payload));
    return;
  }

  await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function sendText(to: string, body: string) {
  await callGraphApi({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

export async function sendButtons(to: string, body: string, buttons: { id: string; title: string }[]) {
  await callGraphApi({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.map((b) => ({ type: "reply", reply: b })) },
    },
  });
}

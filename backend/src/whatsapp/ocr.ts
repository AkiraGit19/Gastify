const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

export interface OcrResult {
  monto?: number;
  fecha?: string;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  camposFaltantes: string[];
  legible: boolean;
}

const CAMPOS = ["monto", "fecha", "proveedor", "rucEmisor", "numeroComprobante"] as const;

// ponytail: no Google Vision key configured yet -> every field is "missing" and the bot
// falls back to asking the employee to confirm each one by hand. Same code path as a low-confidence
// real OCR read, so plugging in the real key later needs no changes to the conversation flow.
export async function readReceipt(_imageBuffer: Buffer): Promise<OcrResult> {
  if (!GOOGLE_VISION_API_KEY) {
    return { camposFaltantes: [...CAMPOS], legible: true };
  }

  const body = {
    requests: [
      {
        image: { content: _imageBuffer.toString("base64") },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return { camposFaltantes: [...CAMPOS], legible: true };

  const json = (await resp.json()) as {
    responses?: [{ fullTextAnnotation?: { text?: string } }];
  };
  const text = json.responses?.[0]?.fullTextAnnotation?.text ?? "";
  if (!text.trim()) return { camposFaltantes: [...CAMPOS], legible: false };

  return parseReceiptText(text);
}

function parseReceiptText(text: string): OcrResult {
  const rucMatch = text.match(/\bRUC\s*:?\s*(\d{11})\b/i);
  const montoMatch = text.match(/(?:S\/\.?|TOTAL\s*:?)\s*(\d+[.,]\d{2})/i);
  const comprobanteMatch = text.match(/\b([A-Z]\d{3}-\d{1,8})\b/);
  const fechaMatch = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);

  const result: OcrResult = { camposFaltantes: [], legible: true };
  if (rucMatch) result.rucEmisor = rucMatch[1];
  else result.camposFaltantes.push("rucEmisor");

  if (montoMatch) result.monto = Number(montoMatch[1].replace(",", "."));
  else result.camposFaltantes.push("monto");

  if (comprobanteMatch) result.numeroComprobante = comprobanteMatch[1];
  else result.camposFaltantes.push("numeroComprobante");

  if (fechaMatch) result.fecha = fechaMatch[1];
  else result.camposFaltantes.push("fecha");

  result.camposFaltantes.push("proveedor"); // razón social confirmation always asked back to the user
  return result;
}

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

export interface OcrResult {
  monto?: number;
  fecha?: string;
  proveedor?: string;
  rucEmisor?: string;
  numeroComprobante?: string;
  // El IGV impreso, cuando la factura lo desglosa. Fuera de camposFaltantes a propósito: no es
  // un dato que se le pida al empleado, se deriva del total si no se pudo leer (ver comprobante.ts).
  igv?: number;
  camposFaltantes: string[];
  legible: boolean;
}

const CAMPOS = ["monto", "fecha", "proveedor", "rucEmisor", "numeroComprobante"] as const;

// null significa "no lo pude leer con certeza", nunca "lo adiviné". Un null hace que le
// preguntemos al empleado; un valor inventado entra a la contabilidad y nadie lo detecta
// hasta el cierre de mes. Toda la exactitud de este módulo depende de esa distinción.
//
// Se usa el helper de JSON Schema y no el de zod a propósito: @anthropic-ai/sdk/helpers/zod
// importa `zod/v4` y el proyecto está en zod 3, así que ahí la inferencia de tipos se cae.
const BOLETA_SCHEMA = {
  type: "object",
  properties: {
    legible: { type: "boolean", description: "false solo si la imagen no es un comprobante o está tan borrosa o cortada que no se puede leer nada" },
    monto: { type: ["number", "null"], description: "Importe TOTAL a pagar, el del pie del comprobante. Nunca el subtotal, el IGV, ni el precio de una línea de producto" },
    fecha: { type: ["string", "null"], description: "Fecha de emisión en formato DD/MM/AAAA" },
    proveedor: { type: ["string", "null"], description: "Razón social o nombre comercial del emisor" },
    rucEmisor: { type: ["string", "null"], description: "RUC del emisor: exactamente 11 dígitos, sin espacios" },
    numeroComprobante: { type: ["string", "null"], description: "Serie y correlativo, ej. F001-00001234 o B001-123" },
    igv: { type: ["number", "null"], description: "Monto del IGV desglosado, solo si el comprobante lo muestra como línea aparte. null si no aparece" },
  },
  required: ["legible", "monto", "fecha", "proveedor", "rucEmisor", "numeroComprobante", "igv"],
  additionalProperties: false,
} as const;

interface Boleta {
  legible: boolean;
  monto: number | null;
  fecha: string | null;
  proveedor: string | null;
  rucEmisor: string | null;
  numeroComprobante: string | null;
  igv: number | null;
}

const PROMPT = `Eres un lector de comprobantes de pago peruanos (boletas, facturas, tickets, recibos).

Extrae los datos de la imagen. Reglas, en orden de importancia:

1. Si no estás seguro de un dato, devuelve null. NUNCA adivines ni completes con un valor
   plausible. Un null hace que le preguntemos al empleado, que es barato. Un dato inventado
   entra a la contabilidad de la empresa sin que nadie lo note, que es caro.
2. El monto es el TOTAL a pagar del pie del comprobante ("TOTAL", "IMPORTE TOTAL",
   "TOTAL A PAGAR"). No confundir con SUBTOTAL, OP. GRAVADA, IGV, descuentos, el efectivo
   entregado ni el vuelto, ni con el precio de una línea de producto.
3. El RUC del emisor tiene 11 dígitos y empieza en 10, 15, 17 o 20. Si el comprobante trae
   dos RUC (emisor y cliente), toma el del emisor, que va en la cabecera junto al nombre
   del negocio. Si no distingues cuál es cuál, devuelve null.
4. El IGV solo se devuelve si el comprobante lo muestra desglosado como línea propia
   ("IGV", "I.G.V. 18%"). Si solo hay un total, devuelve null: no lo calcules tú.
5. Devuelve legible: false solo si la imagen no es un comprobante, o está tan borrosa,
   oscura o cortada que no se puede leer nada. Una boleta fea pero legible es legible.`;

// El SDK acepta ANTHROPIC_API_KEY (header x-api-key) o ANTHROPIC_AUTH_TOKEN (Bearer), pero
// solo construimos el cliente si hay una de las dos: sin credenciales `new Anthropic()` explota
// al primer request, y acá preferimos degradar al llenado manual.
//
// ponytail: los tokens OAuth (sk-ant-oat..., los que emite `ant auth login`) necesitan además
// el header de beta; un token de API o de gateway no lo lleva. Se decide por el prefijo en vez
// de pedir una variable de entorno más.
const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
const tieneCredencial = Boolean(process.env.ANTHROPIC_API_KEY || authToken);
const anthropic = tieneCredencial
  ? new Anthropic(
      authToken?.startsWith("sk-ant-oat")
        ? { defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" } }
        : {},
    )
  : null;

// La API exige el media_type real; lo deducimos de los magic bytes en vez de confiar en lo
// que declare quien sube el archivo. HEIC no está en la lista a propósito: la API no lo
// acepta, pero ni Safari (input type=file) ni WhatsApp lo mandan, ambos convierten a JPEG.
export function sniffMediaType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return null;
}

export function toResult(datos: Boleta): OcrResult {
  if (!datos.legible) return { camposFaltantes: [...CAMPOS], legible: false };

  const result: OcrResult = { camposFaltantes: [], legible: true };
  if (datos.igv != null) result.igv = datos.igv;
  for (const campo of CAMPOS) {
    const valor = datos[campo];
    if (valor === null || valor === undefined || valor === "") result.camposFaltantes.push(campo);
    else (result as any)[campo] = valor;
  }
  return result;
}

export async function readReceipt(imageBuffer: Buffer): Promise<OcrResult> {
  // ponytail: sin ANTHROPIC_API_KEY todos los campos salen "faltantes" y el empleado los
  // escribe a mano. Mismo camino que una boleta ilegible, así que enchufar la key después
  // no obliga a tocar nada más.
  if (!anthropic) return { camposFaltantes: [...CAMPOS], legible: true };

  const mediaType = sniffMediaType(imageBuffer);
  if (!mediaType) return { camposFaltantes: [...CAMPOS], legible: false };

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBuffer.toString("base64") } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
      output_config: { format: jsonSchemaOutputFormat(BOLETA_SCHEMA) },
    });

    // Un rechazo del clasificador de seguridad o un JSON que no validó se tratan como
    // "no se pudo leer": el empleado reenvía la foto. Nunca inventamos un gasto.
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { camposFaltantes: [...CAMPOS], legible: false };
    }

    return toResult(response.parsed_output);
  } catch (error: any) {
    // API caída, sin cuota o timeout: no es culpa de la foto. Dejamos que el empleado
    // complete a mano en vez de mandarlo a sacar otra foto que tampoco se va a poder leer.
    //
    // El log NO es opcional: sin él este return es indistinguible de "la boleta no se dejó
    // leer", y un 401/429 se ve en los reportes como empleados que sacan fotos borrosas.
    // Si esto aparece seguido en producción, el problema son las credenciales, no la gente.
    console.error(
      `[ocr] falló la lectura, el empleado completará a mano — status=${error?.status ?? "?"} ${error?.message ?? error}`,
    );
    return { camposFaltantes: [...CAMPOS], legible: true };
  }
}

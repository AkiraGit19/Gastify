import { codigoSunat, partirComprobante } from "../gastos/comprobante.js";
import type { TipoComprobante } from "@prisma/client";

const SUNAT_API_KEY = process.env.SUNAT_VALIDATION_API_KEY;

export interface SunatResult {
  disponible: boolean;
  activo?: boolean;
  razonSocial?: string;
}

// No key, or the provider times out/errors -> "disponible: false". Callers must treat that as
// "pendiente_validacion", never as "inválido" — an unreachable validator is not proof of a bad receipt.
export async function validarRuc(ruc: string): Promise<SunatResult> {
  if (!SUNAT_API_KEY) return { disponible: false };

  try {
    const resp = await fetch(`https://api.apiperu.dev/api/ruc/${ruc}`, {
      headers: { Authorization: `Bearer ${SUNAT_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { disponible: false };

    const json = (await resp.json()) as { data?: { estado?: string; nombre_o_razon_social?: string } };
    return {
      disponible: true,
      activo: json.data?.estado === "ACTIVO",
      razonSocial: json.data?.nombre_o_razon_social,
    };
  } catch {
    return { disponible: false };
  }
}

export interface ComprobanteResult {
  disponible: boolean;
  // Palabra de SUNAT: ACEPTADO, ANULADO, NO AUTORIZADO. `NO EXISTE` cuando no lo encuentra.
  estado?: string;
  // Texto corto para mostrarle a quien aprueba. null cuando no hay nada que observar.
  observacion?: string | null;
}

interface DatosComprobante {
  rucEmisor?: string | null;
  tipoComprobante: TipoComprobante;
  numeroComprobante?: string | null;
  fecha: Date;
  monto: number;
}

// Consulta si el comprobante existe de verdad en SUNAT y en qué estado está.
//
// Esto es lo que separa "leímos una foto" de "verificamos un gasto". Validar solo el RUC —lo que
// hacía antes— dice que la empresa existe, no que la boleta sea real: una factura inventada con
// el RUC de un proveedor de verdad pasaba el filtro sin problema.
//
// Nunca rechaza por su cuenta. Un comprobante ANULADO es una señal fuerte, pero la decisión es de
// una persona: el servicio puede equivocarse, y acusar de fraude a un empleado por una llamada
// HTTP fallida es mucho peor que mandar el gasto a revisión.
export async function validarComprobante(datos: DatosComprobante): Promise<ComprobanteResult> {
  if (!SUNAT_API_KEY) return { disponible: false };

  const codigo = codigoSunat(datos.tipoComprobante);
  const partes = partirComprobante(datos.numeroComprobante);
  // Sin RUC, sin tipo consultable o sin serie no hay nada que preguntar. No es un fallo: es una
  // boleta de la que no se pudo leer lo suficiente, y ya queda en revisión por esa misma razón.
  if (!codigo || !partes || !datos.rucEmisor) return { disponible: false };

  try {
    const resp = await fetch("https://api.apiperu.dev/cpe", {
      method: "POST",
      headers: { Authorization: `Bearer ${SUNAT_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ruc_emisor: datos.rucEmisor,
        codigo_tipo_documento: codigo,
        serie_documento: partes.serie,
        numero_documento: partes.numero,
        fecha_de_emision: datos.fecha.toISOString().slice(0, 10),
        total: datos.monto,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { disponible: false };

    const json = (await resp.json()) as {
      success?: boolean;
      data?: { comprobante_estado_descripcion?: string };
    };

    if (!json.success || !json.data) {
      return { disponible: true, estado: "NO EXISTE", observacion: "SUNAT no encuentra este comprobante" };
    }

    const estado = (json.data.comprobante_estado_descripcion ?? "").toUpperCase();
    if (estado === "ACEPTADO") return { disponible: true, estado, observacion: null };
    return { disponible: true, estado, observacion: `SUNAT reporta el comprobante como ${estado}` };
  } catch {
    return { disponible: false };
  }
}

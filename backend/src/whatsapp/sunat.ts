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

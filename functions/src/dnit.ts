import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const DNIT_API_KEY = defineSecret("DNIT_API_KEY");
const DEFAULT_DNIT_LOOKUP_URL =
  "https://servicios.dnit.gov.py/eset-publico/consultaRucServiceREST/consultaRuc";

type DnitRawPayload = Record<string, unknown>;

type DnitTaxpayerResult = {
  ruc: string;
  dv: string;
  documento: string;
  razonSocial: string;
  nombreComercial?: string;
  estado?: string;
  categoria?: string;
  tipoPersona?: string;
  tipoSociedad?: string;
  mesCierre?: string;
  rucAnterior?: string;
  consultadoEn: string;
  fuente: "dnit";
};

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function firstString(payload: DnitRawPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toTrimmedString(payload[key]);
    if (value) return value;
  }
  return undefined;
}

function parseRucInput(rawValue: unknown): { ruc: string; dv: string; documento: string } {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) {
    throw new HttpsError("invalid-argument", "Debes indicar un RUC valido.");
  }

  const sanitized = raw.replace(/\s+/g, "");
  const separatorIndex = sanitized.lastIndexOf("-");

  const basePart = separatorIndex >= 0 ? sanitized.slice(0, separatorIndex) : sanitized;
  const dvPart = separatorIndex >= 0 ? sanitized.slice(separatorIndex + 1) : "";

  const ruc = basePart.replace(/\D/g, "");
  const dv = dvPart.replace(/\D/g, "");

  if (ruc.length < 5 || dv.length !== 1) {
    throw new HttpsError("invalid-argument", "Use el formato de RUC con DV, por ejemplo 80012345-6.");
  }

  return {
    ruc,
    dv,
    documento: `${ruc}-${dv}`,
  };
}

function resolvePayload(raw: unknown): DnitRawPayload {
  if (Array.isArray(raw)) {
    const first = raw.find((item) => item && typeof item === "object" && !Array.isArray(item));
    if (first) return first as DnitRawPayload;
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as DnitRawPayload;
  }

  throw new HttpsError("unavailable", "La respuesta de DNIT no tuvo un formato valido.");
}

function buildTaxpayerResult(
  payload: DnitRawPayload,
  requested: { ruc: string; dv: string; documento: string }
): DnitTaxpayerResult {
  const ruc = firstString(payload, ["ruc"]) || requested.ruc;
  const dv = firstString(payload, ["dv"]) || requested.dv;
  const razonSocial =
    firstString(payload, ["nombreRazonSocial", "razonSocial", "descripcionRazonSocial"]) || "";
  const nombreComercial = firstString(payload, [
    "nombreFantasia",
    "nombreComercial",
    "descripcionNombreComercial",
  ]);

  if (!razonSocial && !nombreComercial) {
    throw new HttpsError("not-found", `No se encontraron datos en DNIT para ${requested.documento}.`);
  }

  return {
    ruc,
    dv,
    documento: `${ruc}-${dv}`,
    razonSocial: razonSocial || nombreComercial || requested.documento,
    nombreComercial,
    estado: firstString(payload, ["estado", "descripcionEstado"]),
    categoria: firstString(payload, ["categoria", "descripcionCategoria"]),
    tipoPersona: firstString(payload, ["tipoPersona", "descripcionTipoPersona"]),
    tipoSociedad: firstString(payload, ["tipoSociedad", "descripcionTipoSociedad"]),
    mesCierre: firstString(payload, ["mesCierre", "descripcionMesCierre"]),
    rucAnterior: firstString(payload, ["rucAnterior"]),
    consultadoEn: new Date().toISOString(),
    fuente: "dnit",
  };
}

function extractRemoteError(raw: unknown, fallback: string): string {
  if (typeof raw === "string") {
    return raw.trim() || fallback;
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const payload = raw as DnitRawPayload;
    const message =
      firstString(payload, ["message", "mensaje", "error", "descripcion", "detail"]) || fallback;
    return message;
  }

  return fallback;
}

function resolveApiKey(): string {
  const fromEnv = process.env.DNIT_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const fromSecret = DNIT_API_KEY.value()?.trim();
    if (fromSecret) return fromSecret;
  } catch {
    return "";
  }

  return "";
}

export const lookupDnitTaxpayer = onCall({ secrets: [DNIT_API_KEY] }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion para consultar DNIT.");
    }

    const requested = parseRucInput(request.data?.ruc);
    const apiKey = resolveApiKey();

    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "La integracion con DNIT no esta configurada. Defina DNIT_API_KEY y reinicie o despliegue Firebase Functions."
      );
    }

    let url: URL;
    try {
      const lookupUrl = process.env.DNIT_LOOKUP_URL?.trim() || DEFAULT_DNIT_LOOKUP_URL;
      url = new URL(lookupUrl);
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        `La URL de DNIT no es valida. ${error instanceof Error ? error.message : "Error inesperado."}`
      );
    }

    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("ruc", requested.ruc);
    url.searchParams.set("dv", requested.dv);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new HttpsError(
        "unavailable",
        `No se pudo conectar con DNIT. ${error instanceof Error ? error.message : "Error inesperado."}`
      );
    }

    const bodyText = await response.text();
    let parsedBody: unknown = bodyText;

    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      parsedBody = bodyText;
    }

    if (!response.ok) {
      const detail = extractRemoteError(parsedBody, "DNIT devolvio una respuesta no valida.");

      if (response.status === 404) {
        throw new HttpsError("not-found", `No se encontro el RUC ${requested.documento} en DNIT.`);
      }

      if (response.status === 401 || response.status === 403) {
        throw new HttpsError(
          "permission-denied",
          `DNIT rechazo la consulta. Revise la apiKey configurada. ${detail}`
        );
      }

      throw new HttpsError("unavailable", `DNIT no pudo responder la consulta. ${detail}`);
    }

    const payload = resolvePayload(parsedBody);
    const taxpayer = buildTaxpayerResult(payload, requested);

    return { taxpayer };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      `La consulta DNIT fallo antes de completarse. ${error instanceof Error ? error.message : "Error inesperado."}`
    );
  }
});

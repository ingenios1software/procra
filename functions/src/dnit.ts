import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const DNIT_API_KEY = defineSecret("DNIT_API_KEY");
const DEFAULT_DNIT_LOOKUP_URL = "https://servicios.set.gov.py/EsetApiWS/ApiWS/consultaRuc";
const LEGACY_DNIT_LOOKUP_URL =
  "https://servicios.dnit.gov.py/eset-publico/consultaRucServiceREST/consultaRuc";
const MOCK_DNIT_API_KEY = "test_key";

type DnitRawPayload = Record<string, unknown>;
type DnitRequestedDocument = { ruc: string; dv: string; documento: string };
type DnitLookupResponse = {
  taxpayer: DnitTaxpayerResult;
  degraded?: boolean;
  source?: "dnit" | "cache" | "mock";
  warning?: string;
};

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

function parseRucInput(rawValue: unknown): DnitRequestedDocument {
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
    if (first) return resolvePayload(first);
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const payload = raw as DnitRawPayload;
    const nestedTaxpayer = payload.contribuyente;
    if (nestedTaxpayer && typeof nestedTaxpayer === "object" && !Array.isArray(nestedTaxpayer)) {
      return nestedTaxpayer as DnitRawPayload;
    }

    return payload;
  }

  throw new HttpsError("unavailable", "La respuesta de DNIT no tuvo un formato valido.");
}

function buildTaxpayerResult(
  payload: DnitRawPayload,
  requested: DnitRequestedDocument
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

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error.trim() || "Error inesperado.";
  }

  return "Error inesperado.";
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

function resolveLookupUrls(): string[] {
  const override = process.env.DNIT_LOOKUP_URL?.trim();
  if (override) {
    return [override];
  }

  return [DEFAULT_DNIT_LOOKUP_URL, LEGACY_DNIT_LOOKUP_URL];
}

function isMockApiKey(apiKey: string): boolean {
  return apiKey.trim().toLowerCase() === MOCK_DNIT_API_KEY;
}

function buildMockTaxpayer(requested: DnitRequestedDocument): DnitTaxpayerResult {
  return {
    ruc: requested.ruc,
    dv: requested.dv,
    documento: requested.documento,
    razonSocial: `Contribuyente Mock ${requested.documento}`,
    nombreComercial: "DNIT Mock",
    estado: "MOCK",
    categoria: "TEST",
    tipoPersona: "SIMULADO",
    consultadoEn: new Date().toISOString(),
    fuente: "dnit",
  };
}

async function findCachedTaxpayer(
  uid: string,
  requested: DnitRequestedDocument
): Promise<DnitTaxpayerResult | null> {
  try {
    const userSnap = await db.doc(`usuarios/${uid}`).get();
    const empresaId = toTrimmedString(userSnap.get("empresaId"));
    if (!empresaId) {
      return null;
    }

    const cacheSnap = await db.doc(`empresas/${empresaId}/dnitContribuyentes/${requested.documento}`).get();
    if (!cacheSnap.exists) {
      return null;
    }

    return buildTaxpayerResult(cacheSnap.data() ?? {}, requested);
  } catch (error) {
    logger.warn("DNIT cache lookup failed", {
      uid,
      documento: requested.documento,
      error: describeError(error),
    });
    return null;
  }
}

async function buildCachedFallbackResponse(
  uid: string,
  requested: DnitRequestedDocument,
  warning: string,
  reason: unknown
): Promise<DnitLookupResponse | null> {
  const cached = await findCachedTaxpayer(uid, requested);
  if (!cached) {
    return null;
  }

  logger.warn("DNIT lookup degraded to cache", {
    uid,
    documento: requested.documento,
    warning,
    reason: describeError(reason),
  });

  return {
    taxpayer: cached,
    degraded: true,
    source: "cache",
    warning,
  };
}

export const lookupDnitTaxpayer = onCall({ secrets: [DNIT_API_KEY] }, async (request): Promise<DnitLookupResponse> => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion para consultar DNIT.");
    }

    const uid = request.auth.uid;
    const requested = parseRucInput(request.data?.ruc);
    const apiKey = resolveApiKey();

    if (isMockApiKey(apiKey)) {
      logger.info("DNIT lookup served in mock mode", {
        uid,
        documento: requested.documento,
      });

      return {
        taxpayer: buildMockTaxpayer(requested),
        degraded: true,
        source: "mock",
        warning: "La integracion DNIT esta en modo mock (test_key).",
      };
    }

    if (!apiKey) {
      const fallback = await buildCachedFallbackResponse(
        uid,
        requested,
        "La integracion DNIT no esta configurada. Se uso la cache local.",
        "missing_api_key"
      );
      if (fallback) {
        return fallback;
      }

      throw new HttpsError(
        "failed-precondition",
        "La integracion con DNIT no esta configurada. Defina DNIT_API_KEY y reinicie o despliegue Firebase Functions."
      );
    }

    const lookupUrls = resolveLookupUrls();
    const hasCustomLookupUrl = Boolean(process.env.DNIT_LOOKUP_URL?.trim());

    let response: Response | null = null;
    let lastLookupError: unknown = null;

    for (const lookupUrl of lookupUrls) {
      let url: URL;
      try {
        url = new URL(lookupUrl);
      } catch (error) {
        lastLookupError = error;

        if (hasCustomLookupUrl) {
          break;
        }

        logger.warn("Skipping invalid built-in DNIT URL", {
          lookupUrl,
          error: describeError(error),
        });
        continue;
      }

      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("ruc", requested.ruc);
      url.searchParams.set("dv", requested.dv);

      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
        });
        break;
      } catch (error) {
        lastLookupError = error;
        logger.warn("DNIT fetch attempt failed", {
          uid,
          documento: requested.documento,
          lookupUrl,
          error: describeError(error),
        });
      }
    }

    if (!response) {
      const warning = hasCustomLookupUrl
        ? "La URL de DNIT no es valida o no respondio. Se uso la cache local."
        : "DNIT no respondio. Se uso la cache local.";
      const fallback = await buildCachedFallbackResponse(
        uid,
        requested,
        warning,
        lastLookupError
      );
      if (fallback) {
        return fallback;
      }

      if (hasCustomLookupUrl) {
        throw new HttpsError(
          "failed-precondition",
          `La URL de DNIT no es valida o no respondio. ${describeError(lastLookupError)}`
        );
      }

      throw new HttpsError("unavailable", `No se pudo conectar con DNIT. ${describeError(lastLookupError)}`);
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
        const fallback = await buildCachedFallbackResponse(
          uid,
          requested,
          "DNIT rechazo la consulta. Se uso la cache local.",
          detail
        );
        if (fallback) {
          return fallback;
        }

        throw new HttpsError(
          "permission-denied",
          `DNIT rechazo la consulta. Revise la apiKey configurada. ${detail}`
        );
      }

      const fallback = await buildCachedFallbackResponse(
        uid,
        requested,
        "DNIT no pudo responder la consulta. Se uso la cache local.",
        detail
      );
      if (fallback) {
        return fallback;
      }

      throw new HttpsError("unavailable", `DNIT no pudo responder la consulta. ${detail}`);
    }

    try {
      const payload = resolvePayload(parsedBody);
      const taxpayer = buildTaxpayerResult(payload, requested);

      return { taxpayer, source: "dnit" };
    } catch (error) {
      if (error instanceof HttpsError && error.code === "not-found") {
        throw error;
      }

      const fallback = await buildCachedFallbackResponse(
        uid,
        requested,
        "DNIT devolvio una respuesta invalida. Se uso la cache local.",
        error
      );
      if (fallback) {
        return fallback;
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "unavailable",
        `La respuesta de DNIT no pudo procesarse. ${describeError(error)}`
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      `La consulta DNIT fallo antes de completarse. ${describeError(error)}`
    );
  }
});

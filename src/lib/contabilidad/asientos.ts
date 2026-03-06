import type { AsientoDiario, PlanDeCuenta, Zafra } from "@/lib/types";

export const ZAFRA_FILTER_ALL = "__all__";
export const ZAFRA_FILTER_NONE = "__none__";

export type ZafraContableContext = {
  zafraId?: string;
  zafraNombre?: string | null;
};

function cleanText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveZafraContext(
  zafras: Zafra[] | null | undefined,
  zafraId?: string | null,
  fallbackName?: string | null
): ZafraContableContext {
  const id = cleanText(zafraId);
  const nombreDesdeLista = id ? zafras?.find((item) => item.id === id)?.nombre : undefined;
  const nombre = cleanText(fallbackName) || cleanText(nombreDesdeLista);

  return {
    ...(id ? { zafraId: id } : {}),
    ...(nombre ? { zafraNombre: nombre } : {}),
  };
}

export function withZafraContext<T extends object>(
  value: T,
  context?: ZafraContableContext | null
): T & ZafraContableContext {
  if (!context) return value as T & ZafraContableContext;

  const zafraId = cleanText(context.zafraId);
  const zafraNombre = cleanText(context.zafraNombre);

  return {
    ...value,
    ...(zafraId ? { zafraId } : {}),
    ...(zafraNombre ? { zafraNombre } : {}),
  };
}

export function getAsientoZafraLabel(asiento: Pick<AsientoDiario, "zafraId" | "zafraNombre">): string {
  return cleanText(asiento.zafraNombre) || cleanText(asiento.zafraId) || "Sin zafra";
}

export function matchesAsientoZafraFilter(
  asiento: Pick<AsientoDiario, "zafraId">,
  filterValue: string
): boolean {
  if (filterValue === ZAFRA_FILTER_ALL) return true;
  if (filterValue === ZAFRA_FILTER_NONE) return !cleanText(asiento.zafraId);
  return cleanText(asiento.zafraId) === cleanText(filterValue);
}

export function getSaldoSegunNaturaleza(
  cuenta: Pick<PlanDeCuenta, "naturaleza">,
  totalDebe: number,
  totalHaber: number
): number {
  return cuenta.naturaleza === "acreedora" ? totalHaber - totalDebe : totalDebe - totalHaber;
}

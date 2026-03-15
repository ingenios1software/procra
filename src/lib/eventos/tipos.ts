import type { Evento, EventoTipoBase, TipoEvento } from "@/lib/types";

export type TipoEventoOption = TipoEvento & {
  persisted: boolean;
};

export const EVENTO_TIPO_BASE_OPTIONS: Array<{ value: EventoTipoBase; label: string }> = [
  { value: "siembra", label: "Siembra" },
  { value: "aplicacion", label: "Aplicacion" },
  { value: "fertilizacion", label: "Fertilizacion" },
  { value: "riego", label: "Riego" },
  { value: "cosecha", label: "Cosecha" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "plagas", label: "Control de Plagas" },
];

export const DEFAULT_TIPOS_EVENTO_SEEDS: Array<Omit<TipoEvento, "id"> & { id: string }> = [
  { id: "tipo-evento-siembra", nombre: "Siembra", tipoBase: "siembra", activo: true, orden: 1, esSistema: true },
  { id: "tipo-evento-aplicacion", nombre: "Aplicacion", tipoBase: "aplicacion", activo: true, orden: 2, esSistema: true },
  { id: "tipo-evento-fertilizacion", nombre: "Fertilizacion", tipoBase: "fertilizacion", activo: true, orden: 3, esSistema: true },
  { id: "tipo-evento-riego", nombre: "Riego", tipoBase: "riego", activo: true, orden: 4, esSistema: true },
  { id: "tipo-evento-cosecha", nombre: "Cosecha", tipoBase: "cosecha", activo: true, orden: 5, esSistema: true },
  { id: "tipo-evento-mantenimiento", nombre: "Mantenimiento", tipoBase: "mantenimiento", activo: true, orden: 6, esSistema: true },
  { id: "tipo-evento-plagas", nombre: "Control de Plagas", tipoBase: "plagas", activo: true, orden: 7, esSistema: true },
];

export function normalizeTipoEventoText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function getTipoBaseFromEvento(tipo?: string | null): EventoTipoBase {
  const normalized = normalizeTipoEventoText(tipo);
  if (normalized.includes("siembra")) return "siembra";
  if (normalized.includes("aplic")) return "aplicacion";
  if (normalized.includes("fertiliz")) return "fertilizacion";
  if (normalized.includes("riego")) return "riego";
  if (normalized.includes("cosecha") || normalized.includes("rendimiento")) return "cosecha";
  if (normalized.includes("mantenimiento")) return "mantenimiento";
  if (normalized.includes("plaga")) return "plagas";
  if (normalized.includes("monitore")) return "monitoreo";
  if (normalized.includes("labor")) return "labores";
  if (normalized.includes("otro")) return "otro";
  return "aplicacion";
}

export function getTipoBaseLabel(tipoBase?: string | null) {
  const normalized = normalizeTipoEventoText(tipoBase);
  const option = EVENTO_TIPO_BASE_OPTIONS.find((item) => item.value === normalized);
  if (option) return option.label;
  if (normalized === "monitoreo") return "Monitoreo";
  if (normalized === "labores") return "Labores";
  if (normalized === "otro") return "Otro";
  return "Aplicacion";
}

export function getStoredEventType(tipoBase: EventoTipoBase): Evento["tipo"] {
  switch (tipoBase) {
    case "siembra":
    case "aplicacion":
    case "fertilizacion":
    case "riego":
    case "cosecha":
    case "mantenimiento":
    case "plagas":
      return tipoBase;
    default:
      return "aplicacion";
  }
}

export function getEventTypeDisplay(
  evento: Pick<Evento, "tipo" | "tipoNombre"> | string | null | undefined,
  tipoBaseFallback?: string | null
) {
  if (!evento) {
    return getTipoBaseLabel(tipoBaseFallback);
  }

  if (typeof evento === "string") {
    const value = String(evento).trim();
    return value
      ? getTipoBaseLabel(getTipoBaseFromEvento(value))
      : getTipoBaseLabel(tipoBaseFallback);
  }

  const nombre = String(evento.tipoNombre ?? "").trim();
  if (nombre) return nombre;
  return getTipoBaseLabel(evento.tipo || tipoBaseFallback);
}

export function sortTiposEvento<T extends Pick<TipoEvento, "nombre" | "orden">>(tipos: T[]) {
  return [...tipos].sort(
    (a, b) =>
      Number(a.orden || 0) - Number(b.orden || 0) ||
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true })
  );
}

export function buildTipoEventoOptions(tiposEvento?: TipoEvento[] | null): TipoEventoOption[] {
  const tiposPersistidos = tiposEvento || [];
  const nombresDesactivados = new Set(
    tiposPersistidos
      .filter((tipo) => tipo.activo === false)
      .map((tipo) => normalizeTipoEventoText(tipo.nombre))
  );

  const baseOptions: TipoEventoOption[] = DEFAULT_TIPOS_EVENTO_SEEDS
    .filter((tipo) => !nombresDesactivados.has(normalizeTipoEventoText(tipo.nombre)))
    .map((tipo) => ({ ...tipo, persisted: false }));

  const merged = [...baseOptions];
  const activos = sortTiposEvento(tiposPersistidos.filter((tipo) => tipo.activo !== false));

  activos.forEach((tipo) => {
    const option = { ...tipo, persisted: true } satisfies TipoEventoOption;
    const existingIndex = merged.findIndex(
      (current) => normalizeTipoEventoText(current.nombre) === normalizeTipoEventoText(tipo.nombre)
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = option;
      return;
    }

    merged.push(option);
  });

  return sortTiposEvento(merged);
}

export function findTipoEventoOption(
  options: TipoEventoOption[],
  current: Pick<Evento, "tipo" | "tipoNombre" | "tipoEventoId">
) {
  if (current.tipoEventoId) {
    const byId = options.find((option) => option.id === current.tipoEventoId);
    if (byId) return byId;
  }

  const normalizedNombre = normalizeTipoEventoText(current.tipoNombre);
  if (normalizedNombre) {
    const byName = options.find((option) => normalizeTipoEventoText(option.nombre) === normalizedNombre);
    if (byName) return byName;
  }

  const tipoBase = getTipoBaseFromEvento(current.tipo);
  const matchesByBase = options.filter((option) => option.tipoBase === tipoBase);
  return matchesByBase.length === 1 ? matchesByBase[0] : null;
}

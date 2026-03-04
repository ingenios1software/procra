export const CATEGORIA_GRANO = "grano";

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function toPositiveNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export function calcularPrecioPromedioPonderado(
  stockActual: number,
  precioPromedioActual: number,
  cantidadMovimiento: number,
  precioMovimiento: number
): number {
  const stockAntes = toPositiveNumber(stockActual);
  const precioAntes = toPositiveNumber(precioPromedioActual);
  const cantidad = toPositiveNumber(cantidadMovimiento);
  const precio = toPositiveNumber(precioMovimiento);
  const nuevoStock = stockAntes + cantidad;
  if (nuevoStock <= 0) return 0;
  return (stockAntes * precioAntes + cantidad * precio) / nuevoStock;
}

export function buildGranoInsumoId(cultivoId: string): string {
  return `grano-${cultivoId}`;
}

export function buildGranoInsumoCodigo(cultivoNombre: string, cultivoId: string): string {
  const tokenNombre = normalizeToken(cultivoNombre);
  if (tokenNombre) return `GRANO-${tokenNombre}`;
  return `GRANO-${normalizeToken(cultivoId)}`;
}

export function buildStockGranoDocId(insumoId: string, zafraId: string, parcelaId: string): string {
  return `${insumoId}__${zafraId}__${parcelaId}`;
}

export function isCategoriaGrano(categoria?: string | null): boolean {
  return (categoria || "").trim().toLowerCase() === CATEGORIA_GRANO;
}

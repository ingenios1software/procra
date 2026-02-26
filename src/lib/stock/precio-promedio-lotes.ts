import type { CompraNormal, Insumo, LoteInsumo } from "@/lib/types";

function parseLocaleNumber(value: string): number {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return NaN;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    // El separador que aparece al final se asume decimal.
    if (lastComma > lastDot) {
      return Number(cleaned.replace(/\./g, "").replace(",", "."));
    }
    return Number(cleaned.replace(/,/g, ""));
  }

  if (hasComma) {
    // 1,234,567 o 1234,56
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      return Number(cleaned.replace(/,/g, ""));
    }
    return Number(cleaned.replace(",", "."));
  }

  if (hasDot) {
    // Si solo hay punto, priorizamos parseo decimal estándar (p.ej. 339.245).
    // Para miles con puntos, el dato debería venir numérico desde origen.
    return Number(cleaned);
  }

  return Number(cleaned);
}

export function toPositiveNumber(value: unknown): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseLocaleNumber(value)
        : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function buildComprasById(compras: CompraNormal[]): Map<string, CompraNormal> {
  return new Map(compras.map((compra) => [compra.id, compra]));
}

export function getCostoUnitarioDeLote(
  lote: LoteInsumo,
  comprasById: Map<string, CompraNormal>
): number | null {
  const costoDirecto = toPositiveNumber(lote.costoUnitario);
  if (costoDirecto > 0) return costoDirecto;

  if (lote.origen !== "compra" || !lote.origenId) return null;
  const compra = comprasById.get(lote.origenId);
  if (!compra?.mercaderias?.length) return null;

  const loteCodigo = normalizeText(lote.codigoLote);
  const matchExacto = compra.mercaderias.find(
    (item) =>
      item.insumoId === lote.insumoId &&
      normalizeText(item.lote) === loteCodigo
  );
  if (matchExacto) {
    const costoExacto = toPositiveNumber(matchExacto.valorUnitario);
    if (costoExacto > 0) return costoExacto;
  }

  const itemsInsumo = compra.mercaderias.filter((item) => item.insumoId === lote.insumoId);
  if (itemsInsumo.length === 0) return null;

  let cantidadTotal = 0;
  let importeTotal = 0;
  for (const item of itemsInsumo) {
    const cantidad = toPositiveNumber(item.cantidad);
    const valorUnitario = toPositiveNumber(item.valorUnitario);
    if (cantidad <= 0 || valorUnitario <= 0) continue;
    cantidadTotal += cantidad;
    importeTotal += cantidad * valorUnitario;
  }

  const costo = cantidadTotal > 0 ? (importeTotal / cantidadTotal) : 0;
  return costo > 0 ? costo : null;
}

export function calcularPrecioPromedioDesdeLotes(
  insumo: Insumo,
  lotes: LoteInsumo[],
  comprasById: Map<string, CompraNormal>
): number | null {
  const stockObjetivo = toPositiveNumber(insumo.stockActual);
  const lotesDelInsumo = lotes
    .filter((lote) => lote.insumoId === insumo.id)
    .map((lote) => ({
      lote,
      cantidad: toPositiveNumber(lote.cantidadDisponible ?? lote.cantidadInicial),
      costoUnitario: getCostoUnitarioDeLote(lote, comprasById),
      fechaIngresoTs: new Date(lote.fechaIngreso as any).getTime() || Number.MAX_SAFE_INTEGER,
    }))
    .filter((x) => x.cantidad > 0)
    .sort((a, b) => a.fechaIngresoTs - b.fechaIngresoTs);

  if (lotesDelInsumo.length === 0) return null;

  const fallbackPrecio = toPositiveNumber(insumo.precioPromedioCalculado || insumo.costoUnitario);
  let cantidadTotalLotes = lotesDelInsumo.reduce((acc, x) => acc + x.cantidad, 0);
  if (cantidadTotalLotes <= 0) return 0;

  // Si hay desalineacion importante entre lotes y stock actual, aproximar consumo FIFO.
  if (stockObjetivo > 0) {
    const diferenciaRelativa = Math.abs(cantidadTotalLotes - stockObjetivo) / stockObjetivo;
    if (diferenciaRelativa > 0.02 && cantidadTotalLotes > stockObjetivo) {
      let exceso = cantidadTotalLotes - stockObjetivo;
      for (const item of lotesDelInsumo) {
        if (exceso <= 0) break;
        const descarga = Math.min(item.cantidad, exceso);
        item.cantidad -= descarga;
        exceso -= descarga;
      }
      cantidadTotalLotes = lotesDelInsumo.reduce((acc, x) => acc + x.cantidad, 0);
    }
  }

  let cantidadConCosto = 0;
  let importeValorizado = 0;

  for (const item of lotesDelInsumo) {
    if (item.cantidad <= 0) continue;
    if (!item.costoUnitario || item.costoUnitario <= 0) continue;
    cantidadConCosto += item.cantidad;
    importeValorizado += item.cantidad * item.costoUnitario;
  }

  // Completa lotes sin costo con precio fallback si existe.
  if (cantidadConCosto < cantidadTotalLotes && fallbackPrecio > 0) {
    const faltante = cantidadTotalLotes - cantidadConCosto;
    cantidadConCosto += faltante;
    importeValorizado += faltante * fallbackPrecio;
  }

  if (cantidadConCosto <= 0) return null;
  return importeValorizado / cantidadConCosto;
}

export function calcularPrecioPromedioDesdeCompras(
  insumoId: string,
  compras: CompraNormal[]
): number | null {
  let cantidadTotal = 0;
  let importeTotal = 0;

  for (const compra of compras) {
    if (compra.estado === "anulado") continue;
    for (const item of compra.mercaderias || []) {
      if (item.insumoId !== insumoId) continue;
      const cantidad = toPositiveNumber(item.cantidad);
      const precio = toPositiveNumber(item.valorUnitario);
      if (cantidad <= 0 || precio <= 0) continue;
      cantidadTotal += cantidad;
      importeTotal += cantidad * precio;
    }
  }

  if (cantidadTotal <= 0) return null;
  return importeTotal / cantidadTotal;
}

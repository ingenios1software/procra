import type { Evento, Insumo } from "@/lib/types";

export const COST_DISTRIBUTION_CATEGORY_ORDER = [
  "Semillas",
  "Herbicidas",
  "Fertilizantes",
  "Insecticidas",
  "Fungicidas",
  "Desecantes",
  "Coadyuvantes",
  "Servicio",
  "Sin categoria",
  "Sin detalle",
] as const;

export const COST_DISTRIBUTION_CATEGORY_COLORS: Record<string, string> = {
  Semillas: "#d96b6b",
  Herbicidas: "#5d8b32",
  Fertilizantes: "#3b82f6",
  Insecticidas: "#8ab84f",
  Fungicidas: "#e5964a",
  Desecantes: "#6b8f3a",
  Coadyuvantes: "#c59a3d",
  Servicio: "#ef8f3c",
  "Sin categoria": "#94a3b8",
  "Sin detalle": "#64748b",
};

export type CostDistributionItem = {
  name: string;
  value: number;
  fill: string;
  order: number;
};

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getInsumoCostCategoryLabel(categoria?: string): string {
  const key = normalizeText(categoria);
  if (!key) return "Sin categoria";
  if (key.includes("herbic")) return "Herbicidas";
  if (key.includes("fertiliz")) return "Fertilizantes";
  if (key.includes("fungic")) return "Fungicidas";
  if (key.includes("insect")) return "Insecticidas";
  if (key.includes("desec")) return "Desecantes";
  if (key.includes("semilla")) return "Semillas";
  if (key.includes("coady")) return "Coadyuvantes";
  return categoria || "Sin categoria";
}

export function getCostDistributionCategoryOrder(name: string): number {
  const index = COST_DISTRIBUTION_CATEGORY_ORDER.indexOf(name as (typeof COST_DISTRIBUTION_CATEGORY_ORDER)[number]);
  return index >= 0 ? index : COST_DISTRIBUTION_CATEGORY_ORDER.length + 1;
}

export function getCostDistributionCategoryColor(name: string): string {
  return COST_DISTRIBUTION_CATEGORY_COLORS[name] || "hsl(var(--chart-5))";
}

export function buildInsumoCostDistribution(eventos: Evento[], insumos: Insumo[]): CostDistributionItem[] {
  const insumosPorId = new Map(insumos.map((insumo) => [insumo.id, insumo]));

  const totals = eventos.reduce((acc, evento) => {
    const productosDelEvento =
      evento.productos ||
      (evento.insumoId
        ? [{ insumoId: evento.insumoId, cantidad: evento.cantidad || 0, dosis: evento.dosis || 0 }]
        : []);

    const productosConCosto = productosDelEvento
      .map((producto) => {
        const insumo = producto?.insumoId ? insumosPorId.get(producto.insumoId) : undefined;
        const categoria = getInsumoCostCategoryLabel(insumo?.categoria);
        const costoUnitario = Number(insumo?.precioPromedioCalculado ?? insumo?.costoUnitario ?? 0) || 0;
        const cantidadDirecta = Number(producto?.cantidad ?? 0) || 0;
        const cantidadCalculada =
          cantidadDirecta > 0
            ? cantidadDirecta
            : (Number(producto?.dosis ?? 0) || 0) * (Number(evento.hectareasAplicadas ?? 0) || 0);
        const costo = Math.max(0, cantidadCalculada * costoUnitario);

        return { categoria, costo };
      })
      .filter((item) => item.costo > 0);

    const costoProductosCalculado = productosConCosto.reduce((sum, item) => sum + item.costo, 0);
    const costoServicioExpl =
      (Number(evento.costoServicioPorHa ?? 0) || 0) * (Number(evento.hectareasAplicadas ?? 0) || 0);
    const costoTotalEvento = Number(evento.costoTotal || 0);

    let costoProductosObjetivo = 0;
    let costoServiciosObjetivo = 0;

    if (costoTotalEvento > 0) {
      if (costoServicioExpl > 0) {
        costoServiciosObjetivo = Math.min(Math.max(0, costoServicioExpl), costoTotalEvento);
        costoProductosObjetivo = Math.max(0, costoTotalEvento - costoServiciosObjetivo);
      } else if (costoProductosCalculado > 0) {
        costoProductosObjetivo = Math.min(costoProductosCalculado, costoTotalEvento);
        costoServiciosObjetivo = Math.max(0, costoTotalEvento - costoProductosObjetivo);
      } else {
        costoProductosObjetivo = costoTotalEvento;
      }
    } else {
      costoProductosObjetivo = costoProductosCalculado;
      costoServiciosObjetivo = Math.max(0, costoServicioExpl);
    }

    if (costoProductosObjetivo > 0) {
      if (costoProductosCalculado > 0) {
        const scale = costoProductosObjetivo / costoProductosCalculado;
        productosConCosto.forEach((item) => {
          acc[item.categoria] = (acc[item.categoria] || 0) + item.costo * scale;
        });
      } else {
        acc["Sin detalle"] = (acc["Sin detalle"] || 0) + costoProductosObjetivo;
      }
    }

    if (costoServiciosObjetivo > 0.01) {
      acc.Servicio = (acc.Servicio || 0) + costoServiciosObjetivo;
    }

    return acc;
  }, {} as Record<string, number>);

  return Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value,
      fill: getCostDistributionCategoryColor(name),
      order: getCostDistributionCategoryOrder(name),
    }))
    .filter((item) => Number(item.value) > 0)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return b.value - a.value;
    });
}

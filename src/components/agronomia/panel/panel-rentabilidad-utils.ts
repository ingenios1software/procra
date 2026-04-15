"use client";

import { buildInsumoCostDistribution } from "@/lib/agronomia-cost-distribution";
import { getTipoBaseFromEvento } from "@/lib/eventos/tipos";
import type { Evento, Insumo, Parcela, Zafra } from "@/lib/types";
import { getCycleMetrics, getEventDate } from "./panel-evento-utils";

export type ParcelBusinessSummary = {
  parcelaId: string;
  parcelaNombre: string;
  superficie: number;
  eventosCount: number;
  isClosed: boolean;
  costoTotal: number;
  costoPorHa: number;
  ingresoTotal: number;
  ingresoPorHa: number;
  margenNeto: number;
  margenPorHa: number;
  margenPct: number;
  roiPct: number;
  toneladas: number;
  hectareasCosechadas: number;
  rendimientoTonHa: number;
  rendimientoKgHa: number;
  precioPromedioTonelada: number;
};

export type SelectionBusinessSummary = {
  parcelasCount: number;
  parcelasConCosecha: number;
  superficieTotal: number;
  costoTotal: number;
  costoPorHa: number;
  ingresoTotal: number;
  ingresoPorHa: number;
  margenNeto: number;
  margenPorHa: number;
  margenPct: number;
  roiPct: number;
  toneladas: number;
  hectareasCosechadas: number;
  rendimientoTonHa: number;
  rendimientoKgHa: number;
  precioPromedioTonelada: number;
  shareServiciosPct: number;
  shareInsumosPct: number;
  bestParcel: ParcelBusinessSummary | null;
  rankingCriterion: "margen" | "costo";
};

export type CampaignComparisonSummary = {
  comparableParcelCount: number;
  previousZafraNombre: string;
  rendimientoChangePct: number | null;
  ingresoChangePct: number | null;
  margenChangePct: number | null;
  costoPorHaChangePct: number | null;
  headline: string;
  detail: string;
};

export type SmartAlert = {
  id: string;
  level: "positive" | "warning" | "critical" | "info";
  title: string;
  description: string;
};

function toPositiveNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getComparableChange(currentValue: number, previousValue: number) {
  if (previousValue <= 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function formatChangeLabel(value: number | null, suffix = "%") {
  if (value === null || !Number.isFinite(value)) return "Sin base comparable";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

export function buildParcelBusinessSummaries(
  parcelas: Parcela[],
  eventos: Evento[],
  zafra: Zafra
): ParcelBusinessSummary[] {
  return parcelas.map((parcela) => {
    const eventosParcela = eventos.filter((evento) => evento.parcelaId === parcela.id);
    const ciclo = getCycleMetrics(zafra, eventosParcela);
    const eventosCosecha = eventosParcela.filter((evento) => getTipoBaseFromEvento(evento.tipo) === "cosecha");
    const toneladas = eventosCosecha.reduce((total, evento) => total + toPositiveNumber(evento.toneladas), 0);
    const ingresoTotal = eventosCosecha.reduce(
      (total, evento) => total + toPositiveNumber(evento.toneladas) * toPositiveNumber(evento.precioTonelada),
      0
    );
    const hectareasExpl = eventosCosecha.reduce((total, evento) => {
      return total + toPositiveNumber(evento.hectareasRendimiento ?? evento.hectareasAplicadas);
    }, 0);
    const hectareasCosechadas =
      hectareasExpl > 0 ? hectareasExpl : toneladas > 0 ? toPositiveNumber(parcela.superficie) : 0;
    const rendimientoTonHa = hectareasCosechadas > 0 ? toneladas / hectareasCosechadas : 0;
    const rendimientoKgHa = rendimientoTonHa * 1000;
    const precioPromedioTonelada = toneladas > 0 ? ingresoTotal / toneladas : 0;
    const costoTotal = eventosParcela.reduce((total, evento) => total + (Number(evento.costoTotal) || 0), 0);
    const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
    const ingresoPorHa = parcela.superficie > 0 ? ingresoTotal / parcela.superficie : 0;
    const margenNeto = ingresoTotal - costoTotal;
    const margenPorHa = parcela.superficie > 0 ? margenNeto / parcela.superficie : 0;
    const margenPct = ingresoTotal > 0 ? (margenNeto / ingresoTotal) * 100 : 0;
    const roiPct = costoTotal > 0 ? (margenNeto / costoTotal) * 100 : 0;

    return {
      parcelaId: parcela.id,
      parcelaNombre: parcela.nombre,
      superficie: toPositiveNumber(parcela.superficie),
      eventosCount: eventosParcela.length,
      isClosed: ciclo.isClosed,
      costoTotal,
      costoPorHa,
      ingresoTotal,
      ingresoPorHa,
      margenNeto,
      margenPorHa,
      margenPct,
      roiPct,
      toneladas,
      hectareasCosechadas,
      rendimientoTonHa,
      rendimientoKgHa,
      precioPromedioTonelada,
    };
  });
}

export function buildSelectionBusinessSummary(
  parcelSummaries: ParcelBusinessSummary[],
  eventos: Evento[],
  insumos: Insumo[]
): SelectionBusinessSummary {
  const superficieTotal = parcelSummaries.reduce((total, item) => total + item.superficie, 0);
  const costoTotal = parcelSummaries.reduce((total, item) => total + item.costoTotal, 0);
  const ingresoTotal = parcelSummaries.reduce((total, item) => total + item.ingresoTotal, 0);
  const toneladas = parcelSummaries.reduce((total, item) => total + item.toneladas, 0);
  const hectareasCosechadas = parcelSummaries.reduce((total, item) => total + item.hectareasCosechadas, 0);
  const parcelasConCosecha = parcelSummaries.filter((item) => item.toneladas > 0).length;
  const costoPorHa = superficieTotal > 0 ? costoTotal / superficieTotal : 0;
  const ingresoPorHa = superficieTotal > 0 ? ingresoTotal / superficieTotal : 0;
  const margenNeto = ingresoTotal - costoTotal;
  const margenPorHa = superficieTotal > 0 ? margenNeto / superficieTotal : 0;
  const margenPct = ingresoTotal > 0 ? (margenNeto / ingresoTotal) * 100 : 0;
  const roiPct = costoTotal > 0 ? (margenNeto / costoTotal) * 100 : 0;
  const rendimientoTonHa = hectareasCosechadas > 0 ? toneladas / hectareasCosechadas : 0;
  const rendimientoKgHa = rendimientoTonHa * 1000;
  const precioPromedioTonelada = toneladas > 0 ? ingresoTotal / toneladas : 0;

  const distribucion = buildInsumoCostDistribution(eventos, insumos);
  const totalServicios = distribucion
    .filter((item) => item.name === "Servicio")
    .reduce((total, item) => total + item.value, 0);
  const totalInsumos = distribucion
    .filter((item) => item.name !== "Servicio")
    .reduce((total, item) => total + item.value, 0);
  const totalDistribucion = totalServicios + totalInsumos;
  const shareServiciosPct = totalDistribucion > 0 ? (totalServicios / totalDistribucion) * 100 : 0;
  const shareInsumosPct = totalDistribucion > 0 ? (totalInsumos / totalDistribucion) * 100 : 0;

  const rankingCriterion: "margen" | "costo" = ingresoTotal > 0 ? "margen" : "costo";
  const bestParcel =
    [...parcelSummaries]
      .filter((item) => item.eventosCount > 0)
      .sort((first, second) => {
        if (rankingCriterion === "margen") {
          return (
            second.margenPorHa - first.margenPorHa ||
            second.rendimientoKgHa - first.rendimientoKgHa ||
            first.costoPorHa - second.costoPorHa
          );
        }

        return (
          first.costoPorHa - second.costoPorHa ||
          second.eventosCount - first.eventosCount ||
          first.parcelaNombre.localeCompare(second.parcelaNombre, "es", { sensitivity: "base", numeric: true })
        );
      })[0] || null;

  return {
    parcelasCount: parcelSummaries.length,
    parcelasConCosecha,
    superficieTotal,
    costoTotal,
    costoPorHa,
    ingresoTotal,
    ingresoPorHa,
    margenNeto,
    margenPorHa,
    margenPct,
    roiPct,
    toneladas,
    hectareasCosechadas,
    rendimientoTonHa,
    rendimientoKgHa,
    precioPromedioTonelada,
    shareServiciosPct,
    shareInsumosPct,
    bestParcel,
    rankingCriterion,
  };
}

export function buildCampaignComparisonSummary(
  currentSummary: SelectionBusinessSummary,
  previousSummary: SelectionBusinessSummary,
  previousZafraNombre: string,
  comparableParcelCount: number
): CampaignComparisonSummary {
  const rendimientoChangePct = getComparableChange(currentSummary.rendimientoKgHa, previousSummary.rendimientoKgHa);
  const ingresoChangePct = getComparableChange(currentSummary.ingresoTotal, previousSummary.ingresoTotal);
  const margenChangePct = getComparableChange(currentSummary.margenNeto, previousSummary.margenNeto);
  const costoPorHaChangePct = getComparableChange(currentSummary.costoPorHa, previousSummary.costoPorHa);

  let headline = `Comparacion con ${previousZafraNombre}`;
  if (rendimientoChangePct !== null) {
    headline = `${formatChangeLabel(rendimientoChangePct)} rendimiento vs ${previousZafraNombre}`;
  } else if (margenChangePct !== null) {
    headline = `${formatChangeLabel(margenChangePct)} margen neto vs ${previousZafraNombre}`;
  } else if (costoPorHaChangePct !== null) {
    headline = `${formatChangeLabel(costoPorHaChangePct)} costo/ha vs ${previousZafraNombre}`;
  }

  const detailParts = [`${comparableParcelCount} parcela(s) comparables`];
  if (ingresoChangePct !== null) {
    detailParts.push(`${formatChangeLabel(ingresoChangePct)} ingresos`);
  }
  if (costoPorHaChangePct !== null) {
    detailParts.push(`${formatChangeLabel(costoPorHaChangePct)} costo/ha`);
  }

  return {
    comparableParcelCount,
    previousZafraNombre,
    rendimientoChangePct,
    ingresoChangePct,
    margenChangePct,
    costoPorHaChangePct,
    headline,
    detail: detailParts.join(" | "),
  };
}

export function buildSmartAlerts(params: {
  selectionSummary: SelectionBusinessSummary;
  parcelSummaries: ParcelBusinessSummary[];
  comparisonSummary?: CampaignComparisonSummary | null;
  cycleClosed: boolean;
}): SmartAlert[] {
  const { selectionSummary, parcelSummaries, comparisonSummary, cycleClosed } = params;
  const alerts: SmartAlert[] = [];

  if (!cycleClosed && selectionSummary.costoTotal > 0 && selectionSummary.ingresoTotal <= 0) {
    alerts.push({
      id: "campaign-open",
      level: "info",
      title: "Campana en curso",
      description: "El margen es provisorio porque todavia no hay ingresos cerrados por cosecha en la seleccion actual.",
    });
  }

  if (selectionSummary.ingresoTotal > 0 && selectionSummary.margenNeto < 0) {
    alerts.push({
      id: "negative-margin",
      level: "critical",
      title: "Margen negativo",
      description: "Los ingresos estimados de cosecha no cubren los costos acumulados de la seleccion actual.",
    });
  }

  if (selectionSummary.shareServiciosPct >= 35) {
    alerts.push({
      id: "high-services-share",
      level: "warning",
      title: "Alta dependencia de servicios",
      description: `Los servicios explican ${selectionSummary.shareServiciosPct.toFixed(1)}% del costo total. Revise contrataciones y eficiencia operativa.`,
    });
  }

  const parcelasConRendimiento = parcelSummaries.filter((item) => item.rendimientoKgHa > 0);
  const rendimientoPromedio =
    parcelasConRendimiento.length > 0
      ? parcelasConRendimiento.reduce((total, item) => total + item.rendimientoKgHa, 0) / parcelasConRendimiento.length
      : 0;
  const costoPromedio =
    parcelSummaries.length > 0
      ? parcelSummaries.reduce((total, item) => total + item.costoPorHa, 0) / parcelSummaries.length
      : 0;

  parcelSummaries.forEach((item) => {
    if (item.rendimientoKgHa <= 0 || rendimientoPromedio <= 0) return;

    if (item.costoPorHa > costoPromedio * 1.15 && item.rendimientoKgHa < rendimientoPromedio * 0.9) {
      alerts.push({
        id: `cost-vs-yield-${item.parcelaId}`,
        level: "warning",
        title: "Costo alto con rendimiento bajo",
        description: `${item.parcelaNombre} muestra costo/ha por encima del promedio y rendimiento por debajo del lote medio.`,
      });
    }

    if (item.margenNeto < 0) {
      alerts.push({
        id: `negative-margin-${item.parcelaId}`,
        level: "critical",
        title: "Parcela con lucro negativo",
        description: `${item.parcelaNombre} quedo con margen neto negativo segun los datos de cosecha y costos registrados.`,
      });
    }
  });

  const rendimientoChangePct = comparisonSummary?.rendimientoChangePct ?? null;
  if (rendimientoChangePct !== null && rendimientoChangePct >= 10 && comparisonSummary) {
    alerts.push({
      id: "yield-improved",
      level: "positive",
      title: "Mejora de rendimiento",
      description: `${formatChangeLabel(rendimientoChangePct)} rendimiento frente a ${comparisonSummary.previousZafraNombre}.`,
    });
  }

  const costoPorHaChangePct = comparisonSummary?.costoPorHaChangePct ?? null;
  if (costoPorHaChangePct !== null && costoPorHaChangePct >= 12 && comparisonSummary) {
    alerts.push({
      id: "cost-increase",
      level: "warning",
      title: "Costo/ha en alza",
      description: `${formatChangeLabel(costoPorHaChangePct)} costo/ha frente a ${comparisonSummary.previousZafraNombre}.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable-campaign",
      level: "positive",
      title: "Sin alertas criticas",
      description: "La seleccion no presenta desbalances evidentes con la informacion registrada hasta el momento.",
    });
  }

  return alerts.slice(0, 6);
}

export function getLatestEventDate(eventos: Evento[]) {
  return eventos.reduce<Date | null>((latest, evento) => {
    const eventDate = getEventDate(evento);
    if (!eventDate) return latest;
    if (!latest) return eventDate;
    return eventDate.getTime() > latest.getTime() ? eventDate : latest;
  }, null);
}

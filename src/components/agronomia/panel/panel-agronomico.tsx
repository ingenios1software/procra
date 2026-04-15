"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Bookmark, BookmarkPlus, CloudRain, Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLluviaAcumuladaParcelaZafra } from "@/lib/lluvias";
import { formatCurrency, formatInteger } from "@/lib/utils";
import type {
  Cultivo,
  EtapaCultivo,
  Evento,
  Insumo,
  Parcela,
  RegistroLluviaSector,
  Zafra,
} from "@/lib/types";
import { PanelAnalisisEconomico } from "./panel-analisis-economico";
import { PanelGraficos } from "./panel-graficos";
import { PanelInteligenciaRentabilidad } from "./panel-inteligencia-rentabilidad";
import { PanelKpiCards } from "./panel-kpi-cards";
import { PanelParcelaSelector } from "./panel-parcela-selector";
import {
  buildCampaignComparisonSummary,
  buildParcelBusinessSummaries,
  buildSelectionBusinessSummary,
  buildSmartAlerts,
} from "./panel-rentabilidad-utils";
import { PanelTablaAgronomica } from "./panel-tabla-agronomica";
import { getCycleMetrics, getCycleMetricsForParcelSelection, getEventCategoryLabel, getEventDate } from "./panel-evento-utils";

interface PanelAgronomicoProps {
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  eventos: Evento[];
  insumos: Insumo[];
  etapas: EtapaCultivo[];
  lluviasSector: RegistroLluviaSector[];
}

const STORAGE_KEY = "agronomia-panel-parcela-presets";

type ParcelaSelectionItem = {
  parcela: Parcela;
  eventos: Evento[];
  isClosed: boolean;
  lluvia: number;
};

type SavedParcelaSelection = {
  id: string;
  name: string;
  cultivoId: string | null;
  zafraId: string;
  parcelaIds: string[];
  parcelaNames: string[];
  updatedAt: string;
};

function compareEventsByDate(first: Evento, second: Evento) {
  const firstTime = getEventDate(first)?.getTime() ?? 0;
  const secondTime = getEventDate(second)?.getTime() ?? 0;

  if (firstTime !== secondTime) return firstTime - secondTime;

  return (
    first.parcelaId.localeCompare(second.parcelaId, "es", { sensitivity: "base", numeric: true }) ||
    Number(first.numeroItem ?? first.numeroLanzamiento ?? 0) - Number(second.numeroItem ?? second.numeroLanzamiento ?? 0) ||
    first.id.localeCompare(second.id, "es", { sensitivity: "base", numeric: true })
  );
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getZafraSortTime(zafra: Zafra) {
  return (
    toDate(zafra.fechaFin)?.getTime() ||
    toDate(zafra.fechaInicio)?.getTime() ||
    0
  );
}

function formatSurface(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function buildSelectionLabel(parcelas: Parcela[]) {
  if (parcelas.length === 0) return "";
  if (parcelas.length === 1) return parcelas[0].nombre;
  return `${parcelas.length} parcelas`;
}

function buildSelectionDetail(parcelas: Parcela[]) {
  if (parcelas.length === 0) return "";
  if (parcelas.length <= 2) {
    return parcelas.map((parcela) => parcela.nombre).join(", ");
  }

  return `${parcelas[0].nombre}, ${parcelas[1].nombre} y ${parcelas.length - 2} mas`;
}

function buildDefaultPresetName(parcelas: Parcela[]) {
  if (parcelas.length === 0) return "Seleccion";
  if (parcelas.length === 1) return parcelas[0].nombre;
  if (parcelas.length === 2) return `${parcelas[0].nombre} + ${parcelas[1].nombre}`;
  return `${parcelas[0].nombre} + ${parcelas.length - 1} mas`;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function haveSameIds(first: string[], second: string[]) {
  if (first.length !== second.length) return false;

  const firstSet = new Set(first);
  return second.every((id) => firstSet.has(id));
}

export function PanelAgronomico({
  parcelas,
  cultivos,
  zafras,
  eventos,
  insumos,
  etapas,
  lluviasSector,
}: PanelAgronomicoProps) {
  const [selectedCultivoId, setSelectedCultivoId] = useState<string | null>(null);
  const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
  const [selectedParcelaIds, setSelectedParcelaIds] = useState<string[]>([]);
  const [showDetailedReport, setShowDetailedReport] = useState(true);
  const [presetName, setPresetName] = useState("");
  const [savedSelections, setSavedSelections] = useState<SavedParcelaSelection[]>([]);

  const parcelasById = useMemo(
    () => new Map(parcelas.map((parcela) => [parcela.id, parcela])),
    [parcelas]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const normalized = parsed
        .filter((item): item is SavedParcelaSelection => {
          return Boolean(
            item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.zafraId === "string" &&
              Array.isArray(item.parcelaIds)
          );
        })
        .map((item) => ({
          id: item.id,
          name: item.name,
          cultivoId: item.cultivoId || null,
          zafraId: item.zafraId,
          parcelaIds: item.parcelaIds.filter((id) => typeof id === "string"),
          parcelaNames: Array.isArray(item.parcelaNames)
            ? item.parcelaNames.filter((name) => typeof name === "string")
            : [],
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
        }));

      setSavedSelections(normalized);
    } catch (error) {
      console.error("No se pudieron cargar las selecciones guardadas del panel agronomico.", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSelections));
    } catch (error) {
      console.error("No se pudieron guardar las selecciones del panel agronomico.", error);
    }
  }, [savedSelections]);

  const handleCultivoChange = (cultivoId: string) => {
    setSelectedCultivoId(cultivoId);
    setSelectedZafraId(null);
    setSelectedParcelaIds([]);
  };

  const handleZafraChange = (zafraId: string) => {
    setSelectedZafraId(zafraId);

    const parcelasConEventos = new Set(eventos.filter((evento) => evento.zafraId === zafraId).map((evento) => evento.parcelaId));
    const nextSelection = parcelas
      .filter((parcela) => parcelasConEventos.has(parcela.id))
      .map((parcela) => parcela.id);

    setSelectedParcelaIds(nextSelection);
  };

  const zafrasFiltradas = useMemo(() => {
    if (!selectedCultivoId) return zafras;
    return zafras.filter((zafra) => zafra.cultivoId === selectedCultivoId);
  }, [selectedCultivoId, zafras]);

  const zafraActualAtajo = useMemo(() => {
    return [...zafrasFiltradas]
      .filter((item) => item.estado === "en curso")
      .sort((first, second) => getZafraSortTime(second) - getZafraSortTime(first))[0] || null;
  }, [zafrasFiltradas]);

  const zafraAnteriorAtajo = useMemo(() => {
    return [...zafrasFiltradas]
      .filter((item) => item.estado === "finalizada")
      .sort((first, second) => getZafraSortTime(second) - getZafraSortTime(first))[0] || null;
  }, [zafrasFiltradas]);

  const zafra = useMemo(
    () => zafras.find((item) => item.id === selectedZafraId) || null,
    [selectedZafraId, zafras]
  );
  const cultivo = useMemo(
    () => cultivos.find((item) => item.id === zafra?.cultivoId) || null,
    [cultivos, zafra]
  );

  const eventosZafra = useMemo(() => {
    if (!selectedZafraId) return [];
    return eventos.filter((evento) => evento.zafraId === selectedZafraId).sort(compareEventsByDate);
  }, [selectedZafraId, eventos]);

  const eventosPorParcela = useMemo(() => {
    const grouped = new Map<string, Evento[]>();

    eventosZafra.forEach((evento) => {
      const current = grouped.get(evento.parcelaId) || [];
      current.push(evento);
      grouped.set(evento.parcelaId, current);
    });

    return grouped;
  }, [eventosZafra]);

  const parcelasFiltradas = useMemo(() => {
    if (!selectedZafraId) return [];

    return parcelas
      .filter((parcela) => eventosPorParcela.has(parcela.id))
      .sort((first, second) => first.nombre.localeCompare(second.nombre, "es", { sensitivity: "base", numeric: true }));
  }, [selectedZafraId, parcelas, eventosPorParcela]);

  useEffect(() => {
    const validIds = new Set(parcelasFiltradas.map((parcela) => parcela.id));

    setSelectedParcelaIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [parcelasFiltradas]);

  const parcelasDisponibles = useMemo<ParcelaSelectionItem[]>(() => {
    if (!zafra) return [];

    return parcelasFiltradas.map((parcela) => {
      const eventosParcela = eventosPorParcela.get(parcela.id) || [];
      const cycle = getCycleMetrics(zafra, eventosParcela);
      const lluvia = getLluviaAcumuladaParcelaZafra(parcelas, lluviasSector, parcela.id, zafra.id);

      return {
        parcela,
        eventos: eventosParcela,
        isClosed: cycle.isClosed,
        lluvia,
      };
    });
  }, [eventosPorParcela, lluviasSector, parcelas, parcelasFiltradas, zafra]);

  const parcelasSeleccionadas = useMemo(() => {
    const selectedIds = new Set(selectedParcelaIds);
    return parcelasDisponibles.filter((item) => selectedIds.has(item.parcela.id));
  }, [parcelasDisponibles, selectedParcelaIds]);

  const parcelasSeleccionadasList = useMemo(
    () => parcelasSeleccionadas.map((item) => item.parcela),
    [parcelasSeleccionadas]
  );

  const filteredEvents = useMemo(
    () => parcelasSeleccionadas.flatMap((item) => item.eventos).sort(compareEventsByDate),
    [parcelasSeleccionadas]
  );

  const cycleMetrics = useMemo(() => {
    if (!zafra || parcelasSeleccionadas.length === 0) return null;
    return getCycleMetricsForParcelSelection(
      zafra,
      filteredEvents,
      parcelasSeleccionadas.map((item) => item.parcela.id)
    );
  }, [filteredEvents, parcelasSeleccionadas, zafra]);

  const superficieSeleccionada = useMemo(
    () => parcelasSeleccionadas.reduce((total, item) => total + (Number(item.parcela.superficie) || 0), 0),
    [parcelasSeleccionadas]
  );

  const costoTotal = useMemo(
    () => filteredEvents.reduce((total, evento) => total + (evento.costoTotal || 0), 0),
    [filteredEvents]
  );

  const costoPorHa = superficieSeleccionada > 0 ? costoTotal / superficieSeleccionada : 0;
  const lluviaPromedio = useMemo(() => {
    if (parcelasSeleccionadas.length === 0) return 0;
    const total = parcelasSeleccionadas.reduce((sum, item) => sum + item.lluvia, 0);
    return total / parcelasSeleccionadas.length;
  }, [parcelasSeleccionadas]);

  const parcelasCerradasSeleccionadas = parcelasSeleccionadas.filter((item) => item.isClosed).length;
  const parcelasAbiertasSeleccionadas = parcelasSeleccionadas.length - parcelasCerradasSeleccionadas;
  const selectionLabel = buildSelectionLabel(parcelasSeleccionadasList);
  const selectionDetail = buildSelectionDetail(parcelasSeleccionadasList);
  const defaultPresetName = buildDefaultPresetName(parcelasSeleccionadasList);
  const hasSelection = Boolean(zafra && cultivo && cycleMetrics && parcelasSeleccionadas.length > 0);

  const currentParcelBusiness = useMemo(() => {
    if (!zafra || parcelasSeleccionadasList.length === 0) return [];
    return buildParcelBusinessSummaries(parcelasSeleccionadasList, filteredEvents, zafra);
  }, [filteredEvents, parcelasSeleccionadasList, zafra]);

  const currentSelectionBusiness = useMemo(() => {
    if (!hasSelection) return null;
    return buildSelectionBusinessSummary(currentParcelBusiness, filteredEvents, insumos);
  }, [currentParcelBusiness, filteredEvents, hasSelection, insumos]);

  const comparisonZafra = useMemo(() => {
    if (!selectedCultivoId || !zafra) return null;

    const closedZafras = [...zafrasFiltradas]
      .filter((item) => item.estado === "finalizada")
      .sort((first, second) => getZafraSortTime(second) - getZafraSortTime(first));

    if (closedZafras.length === 0) return null;

    if (zafra.estado !== "finalizada") {
      return closedZafras[0] || null;
    }

    const currentIndex = closedZafras.findIndex((item) => item.id === zafra.id);
    if (currentIndex >= 0) {
      return closedZafras[currentIndex + 1] || null;
    }

    return closedZafras[0] || null;
  }, [selectedCultivoId, zafra, zafrasFiltradas]);

  const comparisonEventsAll = useMemo(() => {
    if (!comparisonZafra || selectedParcelaIds.length === 0) return [];
    const selectedIdSet = new Set(selectedParcelaIds);
    return eventos
      .filter((evento) => evento.zafraId === comparisonZafra.id && selectedIdSet.has(evento.parcelaId))
      .sort(compareEventsByDate);
  }, [comparisonZafra, eventos, selectedParcelaIds]);

  const comparableParcelIds = useMemo(() => {
    const availableInCurrent = new Set(parcelasSeleccionadasList.map((parcela) => parcela.id));
    const availableInComparison = new Set(comparisonEventsAll.map((evento) => evento.parcelaId));
    return [...availableInCurrent].filter((id) => availableInComparison.has(id));
  }, [comparisonEventsAll, parcelasSeleccionadasList]);

  const comparableParcelas = useMemo(
    () =>
      comparableParcelIds
        .map((id) => parcelasById.get(id))
        .filter((parcela): parcela is Parcela => Boolean(parcela)),
    [comparableParcelIds, parcelasById]
  );

  const currentComparableEvents = useMemo(() => {
    const comparableSet = new Set(comparableParcelIds);
    return filteredEvents.filter((evento) => comparableSet.has(evento.parcelaId));
  }, [comparableParcelIds, filteredEvents]);

  const previousComparableBusiness = useMemo(() => {
    if (!comparisonZafra || comparableParcelas.length === 0) return [];
    return buildParcelBusinessSummaries(comparableParcelas, comparisonEventsAll, comparisonZafra);
  }, [comparableParcelas, comparisonEventsAll, comparisonZafra]);

  const currentComparableBusiness = useMemo(() => {
    if (!zafra || comparableParcelas.length === 0) return [];
    return buildParcelBusinessSummaries(comparableParcelas, currentComparableEvents, zafra);
  }, [comparableParcelas, currentComparableEvents, zafra]);

  const comparisonSummary = useMemo(() => {
    if (!comparisonZafra || comparableParcelas.length === 0) return null;

    const currentComparableSelection = buildSelectionBusinessSummary(currentComparableBusiness, currentComparableEvents, insumos);
    const previousComparableSelection = buildSelectionBusinessSummary(previousComparableBusiness, comparisonEventsAll, insumos);

    return buildCampaignComparisonSummary(
      currentComparableSelection,
      previousComparableSelection,
      comparisonZafra.nombre,
      comparableParcelas.length
    );
  }, [
    comparisonEventsAll,
    comparisonZafra,
    comparableParcelas.length,
    currentComparableBusiness,
    currentComparableEvents,
    insumos,
    previousComparableBusiness,
  ]);

  const smartAlerts = useMemo(() => {
    if (!currentSelectionBusiness || !cycleMetrics) return [];

    return buildSmartAlerts({
      selectionSummary: currentSelectionBusiness,
      parcelSummaries: currentParcelBusiness,
      comparisonSummary,
      cycleClosed: cycleMetrics.isClosed,
    });
  }, [comparisonSummary, currentParcelBusiness, currentSelectionBusiness, cycleMetrics]);

  const rankingRows = useMemo(() => {
    return [...currentParcelBusiness].sort((first, second) => {
      if (!currentSelectionBusiness || currentSelectionBusiness.rankingCriterion === "margen") {
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
    });
  }, [currentParcelBusiness, currentSelectionBusiness]);

  const presetsForCurrentZafra = useMemo(
    () =>
      savedSelections
        .filter((preset) => preset.zafraId === selectedZafraId)
        .sort((first, second) => {
          const firstTime = new Date(first.updatedAt).getTime() || 0;
          const secondTime = new Date(second.updatedAt).getTime() || 0;
          return secondTime - firstTime;
        }),
    [savedSelections, selectedZafraId]
  );

  const duplicatePreset = useMemo(() => {
    const normalizedName = normalizeText(presetName || defaultPresetName);
    if (!normalizedName || !selectedZafraId) return null;

    return presetsForCurrentZafra.find((preset) => normalizeText(preset.name) === normalizedName) || null;
  }, [defaultPresetName, presetName, presetsForCurrentZafra, selectedZafraId]);

  const shareSummary = hasSelection
    ? `Campana: ${selectionLabel} - ${zafra!.nombre} (${cultivo!.nombre}) | Lluvia promedio: ${lluviaPromedio.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm | Eventos: ${filteredEvents.length} | Costo total: $${costoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currentSelectionBusiness ? ` | Margen: $${currentSelectionBusiness.margenNeto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}.`
    : "Panel agronomico sin seleccion de campana.";

  const exportToExcel = useCallback(() => {
    if (!hasSelection || !zafra || !cultivo || !cycleMetrics) {
      alert("Por favor, seleccione una zafra y una o mas parcelas para exportar.");
      return;
    }

    const resumenData = [
      ["Campana", `${selectionLabel} - ${zafra.nombre}`],
      ["Cultivo", cultivo.nombre],
      ["Parcelas", selectionDetail || selectionLabel],
      ["Superficie Total", `${formatSurface(superficieSeleccionada)} ha`],
      ["Parcelas Cerradas", parcelasCerradasSeleccionadas],
      ["Parcelas Abiertas", parcelasAbiertasSeleccionadas],
      ["Lluvia Promedio", `${lluviaPromedio.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm`],
      ["Fecha Fin Ciclo", format(cycleMetrics.endDate, "dd/MM/yyyy")],
      [cycleMetrics.isClosed ? "Ciclo Cerrado" : "Ciclo a Hoy", `${cycleMetrics.totalDays} dias`],
      ["Eventos Totales", filteredEvents.length],
      ["Costo Total Acumulado", `$${costoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["Costo por Hectarea", `$${costoPorHa.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ...(currentSelectionBusiness
        ? [
            ["Ingresos Estimados", `$${currentSelectionBusiness.ingresoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ["Margen Neto", `$${currentSelectionBusiness.margenNeto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ["ROI", `${currentSelectionBusiness.roiPct.toFixed(2)}%`],
            ["Rendimiento", currentSelectionBusiness.rendimientoKgHa > 0 ? `${currentSelectionBusiness.rendimientoKgHa.toLocaleString("de-DE", { maximumFractionDigits: 0 })} kg/ha` : "Sin cosecha"],
          ]
        : []),
      ...(comparisonSummary
        ? [
            ["Comparacion", comparisonSummary.previousZafraNombre],
            ["Comparacion Headline", comparisonSummary.headline],
          ]
        : []),
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.sheet_add_aoa(wsResumen, [["Panel Agronomico - Resumen"]], { origin: "A1" });
    wsResumen["!cols"] = [{ wch: 25 }, { wch: 42 }];

    const costos = filteredEvents.reduce((acc, evento) => {
      const categoria = getEventCategoryLabel(evento);
      acc[categoria] = (acc[categoria] || 0) + (evento.costoTotal || 0);
      return acc;
    }, {} as Record<string, number>);

    const dataCostos = Object.entries(costos).map(([name, value]) => ({
      Categoria: name,
      "Costo Total": value,
      "Porcentaje (%)": costoTotal > 0 ? Number(((value / costoTotal) * 100).toFixed(2)) : 0,
    }));
    const wsCostos = XLSX.utils.json_to_sheet(dataCostos);
    wsCostos["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];

    const dataProgreso = etapas
      .filter((etapa) => etapa.cultivoId === zafra.cultivoId)
      .sort((first, second) => first.orden - second.orden)
      .map((etapa) => ({
        Orden: etapa.orden,
        "Codigo Etapa": etapa.nombre,
        Descripcion: etapa.descripcion,
        "Inicio (dias)": etapa.diasDesdeSiembraInicio,
        "Fin (dias)": etapa.diasDesdeSiembraFin,
      }));
    const wsCiclo = XLSX.utils.json_to_sheet(dataProgreso);
    wsCiclo["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 42 }, { wch: 16 }, { wch: 16 }];

    const eventosData = filteredEvents.map((evento) => ({
      Fecha: format(getEventDate(evento) || new Date(evento.fecha), "dd/MM/yyyy"),
      Parcela: parcelasById.get(evento.parcelaId)?.nombre || "N/A",
      "Tipo Evento": getEventCategoryLabel(evento),
      Descripcion: evento.descripcion,
      "Costo Evento": evento.costoTotal || 0,
    }));
    const wsEventos = XLSX.utils.json_to_sheet(eventosData);
    wsEventos["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsCostos, "Costos por Categoria");
    XLSX.utils.book_append_sheet(wb, wsCiclo, "Ciclo Fenologico");
    XLSX.utils.book_append_sheet(wb, wsEventos, "Eventos");

    XLSX.writeFile(wb, "panel-agronomico.xlsx");
  }, [
    costoPorHa,
    costoTotal,
    currentSelectionBusiness,
    cultivo,
    cycleMetrics,
    comparisonSummary,
    etapas,
    filteredEvents,
    hasSelection,
    lluviaPromedio,
    parcelasAbiertasSeleccionadas,
    parcelasById,
    parcelasCerradasSeleccionadas,
    selectionDetail,
    selectionLabel,
    superficieSeleccionada,
    zafra,
  ]);

  const saveCurrentPreset = useCallback(() => {
    if (!selectedZafraId || parcelasSeleccionadasList.length === 0) {
      alert("Seleccione una zafra y al menos una parcela para guardar la seleccion.");
      return;
    }

    const name = (presetName.trim() || defaultPresetName).trim();
    const nextPreset: SavedParcelaSelection = {
      id: duplicatePreset?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      cultivoId: selectedCultivoId,
      zafraId: selectedZafraId,
      parcelaIds: parcelasSeleccionadasList.map((parcela) => parcela.id),
      parcelaNames: parcelasSeleccionadasList.map((parcela) => parcela.nombre),
      updatedAt: new Date().toISOString(),
    };

    setSavedSelections((current) => {
      const remaining = current.filter((preset) => preset.id !== nextPreset.id);
      return [nextPreset, ...remaining];
    });
    setPresetName("");
  }, [
    defaultPresetName,
    duplicatePreset?.id,
    parcelasSeleccionadasList,
    presetName,
    selectedCultivoId,
    selectedZafraId,
  ]);

  const applySavedPreset = useCallback((preset: SavedParcelaSelection) => {
    const validIds = new Set(parcelasDisponibles.map((item) => item.parcela.id));
    const nextIds = preset.parcelaIds.filter((id) => validIds.has(id));

    if (nextIds.length === 0) {
      alert("Ninguna de las parcelas guardadas esta disponible en la zafra actual.");
      return;
    }

    setSelectedParcelaIds(nextIds);
  }, [parcelasDisponibles]);

  const deleteSavedPreset = useCallback((presetId: string) => {
    setSavedSelections((current) => current.filter((preset) => preset.id !== presetId));
  }, []);

  return (
    <>
      <PageHeader
        title="Panel Agronomico Inteligente"
        description="Analisis detallado de la campana agricola, desde la siembra hasta la cosecha."
      >
        <div className="no-print flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="mr-2" />
            Exportar Excel
          </Button>
          <ReportActions
            reportTitle="Panel Agronomico Inteligente"
            reportSummary={shareSummary}
            imageTargetId="panel-agronomico-print"
            printTargetId="panel-agronomico-print"
          />
        </div>
      </PageHeader>

      <div id="panel-agronomico-print" className="print-area">
        <Card className="mb-6 no-print">
          <CardContent className="grid gap-2.5 p-2.5 xl:grid-cols-[1.22fr_190px_2fr] xl:items-start">
            <div className="space-y-2.5">
              <div className="space-y-1">
                <CardTitle className="text-[24px] leading-tight">Seleccion de Campana</CardTitle>
                <CardDescription className="text-sm leading-tight">Elija cultivo, zafra y parcelas a analizar.</CardDescription>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <Select onValueChange={handleCultivoChange} value={selectedCultivoId || ""}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Cultivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cultivos.map((cultivoItem) => (
                      <SelectItem key={cultivoItem.id} value={cultivoItem.id}>
                        {cultivoItem.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select onValueChange={handleZafraChange} value={selectedZafraId || ""} disabled={!selectedCultivoId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Zafra" />
                  </SelectTrigger>
                  <SelectContent>
                    {zafrasFiltradas.map((zafraItem) => (
                      <SelectItem key={zafraItem.id} value={zafraItem.id}>
                        {zafraItem.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <PanelParcelaSelector
                  disabled={!selectedZafraId}
                  options={parcelasDisponibles.map((item) => ({
                    id: item.parcela.id,
                    nombre: item.parcela.nombre,
                    superficie: item.parcela.superficie,
                    isClosed: item.isClosed,
                  }))}
                  selectedIds={selectedParcelaIds}
                  onSelectionChange={setSelectedParcelaIds}
                />
              </div>

              {selectedCultivoId ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedZafraId === zafraActualAtajo?.id ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!zafraActualAtajo}
                    onClick={() => zafraActualAtajo && handleZafraChange(zafraActualAtajo.id)}
                  >
                    Campana actual (en curso)
                  </Button>
                  <Button
                    type="button"
                    variant={selectedZafraId === zafraAnteriorAtajo?.id ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!zafraAnteriorAtajo}
                    onClick={() => zafraAnteriorAtajo && handleZafraChange(zafraAnteriorAtajo.id)}
                  >
                    Campana anterior (cerrada)
                  </Button>
                </div>
              ) : null}

              {selectedZafraId ? (
                parcelasDisponibles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <span className="rounded-full border px-2 py-0.5">{parcelasSeleccionadas.length} seleccionadas</span>
                      <span className="rounded-full border px-2 py-0.5">{parcelasCerradasSeleccionadas} cerradas</span>
                      <span className="rounded-full border px-2 py-0.5">{parcelasAbiertasSeleccionadas} abiertas</span>
                      <span className="rounded-full border px-2 py-0.5">{formatSurface(superficieSeleccionada)} ha</span>
                    </div>

                    <div className="rounded-lg border bg-muted/10 px-2.5 py-2">
                      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Selecciones frecuentes
                          </p>
                          {presetsForCurrentZafra.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">Sin guardadas en esta zafra.</span>
                          ) : null}
                          {presetsForCurrentZafra.length > 0 ? (
                            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {presetsForCurrentZafra.length}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-1.5 sm:flex-row xl:w-auto">
                          <Input
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                            placeholder={defaultPresetName || "Nombre de la seleccion"}
                            className="h-8 text-sm sm:w-[170px]"
                            disabled={!hasSelection}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={saveCurrentPreset}
                            disabled={!hasSelection}
                          >
                            <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                            {duplicatePreset ? "Actualizar" : "Guardar"}
                          </Button>
                        </div>
                      </div>

                      {presetsForCurrentZafra.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {presetsForCurrentZafra.map((preset) => {
                            const isActive = haveSameIds(preset.parcelaIds, selectedParcelaIds);

                            return (
                              <div
                                key={preset.id}
                                className="flex items-center rounded-full border bg-background/95 pr-0.5"
                              >
                                <Button
                                  type="button"
                                  variant={isActive ? "secondary" : "ghost"}
                                  size="sm"
                                  className="h-6 rounded-full px-2.5 text-[11px]"
                                  onClick={() => applySavedPreset(preset)}
                                >
                                  <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                                  {preset.name}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full"
                                  onClick={() => deleteSavedPreset(preset.id)}
                                  aria-label={`Eliminar seleccion ${preset.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay parcelas con eventos para la zafra seleccionada.</p>
                )
              ) : null}
            </div>

            <div className="flex min-h-[104px] flex-col justify-between rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lluvia Acumulada</p>
                <CloudRain className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[32px] font-semibold leading-none">
                  {hasSelection
                    ? lluviaPromedio.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
                    : "--"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {hasSelection
                    ? parcelasSeleccionadas.length === 1
                      ? `mm en ${parcelasSeleccionadas[0].parcela.nombre}`
                      : `mm promedio en ${parcelasSeleccionadas.length} parcelas`
                    : "Seleccione una campana"}
                </p>
              </div>
            </div>

            {hasSelection ? (
              <PanelKpiCards
                parcelas={parcelasSeleccionadasList}
                zafra={zafra!}
                cultivo={cultivo!}
                eventos={filteredEvents}
                cycleMetrics={cycleMetrics!}
                className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4"
              />
            ) : (
              <div className="flex min-h-[104px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Seleccione cultivo, zafra y una o mas parcelas para ver el resumen.
              </div>
            )}
          </CardContent>
        </Card>

        {hasSelection ? (
          <>
            {currentSelectionBusiness ? (
              <div className="report-export-only space-y-8">
                <section data-pdf-page className="space-y-6">
                  <Card className="break-inside-avoid">
                    <CardContent className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <CardTitle>Resumen de la campana seleccionada</CardTitle>
                          <CardDescription>
                            Reporte ordenado para PDF con foco en margen, rendimiento, comparacion historica y decisiones sobre la seleccion activa.
                          </CardDescription>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cultivo y zafra</p>
                            <p className="mt-2 text-lg font-semibold">{cultivo!.nombre}</p>
                            <p className="text-sm text-muted-foreground">{zafra!.nombre}</p>
                          </div>
                          <div className="rounded-xl border p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Seleccion</p>
                            <p className="mt-2 text-lg font-semibold">{selectionLabel}</p>
                            <p className="text-sm text-muted-foreground">{selectionDetail || selectionLabel}</p>
                          </div>
                          <div className="rounded-xl border p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ciclo</p>
                            <p className="mt-2 text-lg font-semibold">
                              {cycleMetrics!.isClosed ? "Cerrado" : "En curso"} | {cycleMetrics!.totalDays} dias
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {cycleMetrics!.isClosed
                                ? `Cerrado el ${format(cycleMetrics!.endDate, "dd/MM/yyyy")}`
                                : `Abierto al ${format(cycleMetrics!.endDate, "dd/MM/yyyy")}`}
                            </p>
                          </div>
                          <div className="rounded-xl border p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Superficie y clima</p>
                            <p className="mt-2 text-lg font-semibold">{formatSurface(superficieSeleccionada)} ha</p>
                            <p className="text-sm text-muted-foreground">
                              {lluviaPromedio.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm promedio
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border bg-muted/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lectura principal</p>
                          <p className="mt-2 text-2xl font-semibold">
                            {comparisonSummary ? comparisonSummary.headline : `${currentSelectionBusiness.margenPct.toFixed(1)}% margen estimado`}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {comparisonSummary
                              ? comparisonSummary.detail
                              : currentSelectionBusiness.ingresoTotal > 0
                                ? `El margen actual se apoya en ${currentSelectionBusiness.toneladas.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ton registradas con un precio medio de $${formatCurrency(currentSelectionBusiness.precioPromedioTonelada)}/ton.`
                                : "La campana aun no tiene ingresos valorizados por cosecha; el resultado economico sigue provisorio."}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-muted/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mejor parcela</p>
                          <p className="mt-2 text-xl font-semibold text-primary">
                            {currentSelectionBusiness.bestParcel?.parcelaNombre || "Sin datos suficientes"}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {currentSelectionBusiness.bestParcel
                              ? `${currentSelectionBusiness.bestParcel.rendimientoKgHa > 0 ? `${formatInteger(currentSelectionBusiness.bestParcel.rendimientoKgHa)} kg/ha` : "Sin cosecha"} | $${formatCurrency(currentSelectionBusiness.bestParcel.margenPorHa)}/ha margen`
                              : "Todavia no hay una parcela lider claramente definida con la informacion disponible."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Costo total</p>
                      <p className="mt-2 text-2xl font-semibold">${formatCurrency(currentSelectionBusiness.costoTotal)}</p>
                      <p className="text-sm text-muted-foreground">${formatCurrency(currentSelectionBusiness.costoPorHa)}/ha</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ingresos estimados</p>
                      <p className="mt-2 text-2xl font-semibold">${formatCurrency(currentSelectionBusiness.ingresoTotal)}</p>
                      <p className="text-sm text-muted-foreground">${formatCurrency(currentSelectionBusiness.ingresoPorHa)}/ha</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Margen neto</p>
                      <p className="mt-2 text-2xl font-semibold">${formatCurrency(currentSelectionBusiness.margenNeto)}</p>
                      <p className="text-sm text-muted-foreground">ROI {currentSelectionBusiness.roiPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rendimiento</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {currentSelectionBusiness.rendimientoKgHa > 0 ? formatInteger(currentSelectionBusiness.rendimientoKgHa) : "--"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentSelectionBusiness.rendimientoKgHa > 0 ? "kg/ha" : "Sin cosecha valorizada"}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado de parcelas</p>
                      <p className="mt-2 text-2xl font-semibold">{parcelasCerradasSeleccionadas}/{parcelasSeleccionadas.length}</p>
                      <p className="text-sm text-muted-foreground">cerradas | {parcelasAbiertasSeleccionadas} abiertas</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mix de costos</p>
                      <p className="mt-2 text-2xl font-semibold">{currentSelectionBusiness.shareServiciosPct.toFixed(0)}%</p>
                      <p className="text-sm text-muted-foreground">servicios | {currentSelectionBusiness.shareInsumosPct.toFixed(0)}% insumos</p>
                    </div>
                  </div>

                  <Card className="break-inside-avoid">
                    <CardHeader>
                      <CardTitle>Alertas y observaciones clave</CardTitle>
                      <CardDescription>Ordenadas para lectura rapida en PDF.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      {smartAlerts.slice(0, 4).map((alert) => (
                        <div key={alert.id} className="rounded-xl border p-4">
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{alert.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>

                <section data-pdf-page className="space-y-6">
                  <Card className="break-inside-avoid">
                    <CardHeader>
                      <CardTitle>Graficos agronomicos</CardTitle>
                      <CardDescription>
                        Vista ordenada de ciclo, distribucion de costos y composicion del gasto para la seleccion actual.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <PanelGraficos
                    eventos={filteredEvents}
                    insumos={insumos}
                    zafra={zafra!}
                    etapas={etapas}
                    cycleMetrics={cycleMetrics!}
                    selectionLabel={selectionLabel}
                    pdfMode
                  />
                </section>

                <section data-pdf-page className="space-y-6">
                  <Card className="break-inside-avoid">
                    <CardHeader>
                      <CardTitle>Ranking y lectura operativa</CardTitle>
                      <CardDescription>
                        Priorizacion de lotes segun {currentSelectionBusiness.rankingCriterion === "margen" ? "margen por hectarea" : "costo por hectarea"}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-xl border p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comentario gerencial</p>
                          <p className="mt-3 text-lg font-semibold">
                            {comparisonSummary ? comparisonSummary.headline : "Sin comparacion historica suficiente"}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {comparisonSummary
                              ? comparisonSummary.detail
                              : "El panel usara la campaña cerrada anterior del mismo cultivo cuando existan parcelas comparables dentro del filtro actual."}
                          </p>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <p>Parcela lider: {currentSelectionBusiness.bestParcel?.parcelaNombre || "N/A"}</p>
                            <p>Toneladas registradas: {currentSelectionBusiness.toneladas.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</p>
                            <p>Eventos analizados: {filteredEvents.length}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Top parcelas</p>
                          <div className="mt-4">
                            <Table resizable className="min-w-[640px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Parcela</TableHead>
                                  <TableHead className="text-right">Rendimiento</TableHead>
                                  <TableHead className="text-right">Costo/ha</TableHead>
                                  <TableHead className="text-right">Margen/ha</TableHead>
                                  <TableHead className="text-right">Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rankingRows.slice(0, 8).map((item) => (
                                  <TableRow key={`pdf-ranking-${item.parcelaId}`}>
                                    <TableCell className="font-medium">{item.parcelaNombre}</TableCell>
                                    <TableCell className="text-right">
                                      {item.rendimientoKgHa > 0 ? `${formatInteger(item.rendimientoKgHa)} kg/ha` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">${formatCurrency(item.costoPorHa)}</TableCell>
                                    <TableCell className="text-right">${formatCurrency(item.margenPorHa)}</TableCell>
                                    <TableCell className="text-right">{item.isClosed ? "Cerrada" : "En curso"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <PanelAnalisisEconomico eventos={filteredEvents} insumos={insumos} />
                </section>

                {showDetailedReport ? (
                  <section data-pdf-page className="space-y-6">
                    <PanelTablaAgronomica
                      parcelas={parcelasSeleccionadasList}
                      zafra={zafra!}
                      eventos={filteredEvents}
                      insumos={insumos}
                    />
                  </section>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-6 no-print">
              {currentSelectionBusiness ? (
                <PanelInteligenciaRentabilidad
                  cultivo={cultivo!}
                  zafra={zafra!}
                  selectionLabel={selectionLabel}
                  selectionSummary={currentSelectionBusiness}
                  parcelSummaries={currentParcelBusiness}
                  comparisonSummary={comparisonSummary}
                  alerts={smartAlerts}
                />
              ) : null}

              <PanelGraficos
                eventos={filteredEvents}
                insumos={insumos}
                zafra={zafra!}
                etapas={etapas}
                cycleMetrics={cycleMetrics!}
                selectionLabel={selectionLabel}
              />

              <div className="no-print flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetailedReport((previous) => !previous)}
                  aria-expanded={showDetailedReport}
                >
                  {showDetailedReport ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
                  {showDetailedReport ? "Ocultar Informe Detallado" : "Mostrar Informe Detallado"}
                </Button>
              </div>

              {showDetailedReport ? (
                <PanelTablaAgronomica
                  parcelas={parcelasSeleccionadasList}
                  zafra={zafra!}
                  eventos={filteredEvents}
                  insumos={insumos}
                />
              ) : null}

              <PanelAnalisisEconomico eventos={filteredEvents} insumos={insumos} />
            </div>
          </>
        ) : (
          <Card className="no-print flex h-64 items-center justify-center border-dashed">
            <p className="text-muted-foreground">
              Por favor, seleccione cultivo, zafra y una o mas parcelas para comenzar el analisis.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

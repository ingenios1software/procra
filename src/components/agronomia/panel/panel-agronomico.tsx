"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Bookmark, BookmarkPlus, CloudRain, Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLluviaAcumuladaParcelaZafra } from "@/lib/lluvias";
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
import { PanelKpiCards } from "./panel-kpi-cards";
import { PanelParcelaSelector } from "./panel-parcela-selector";
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
    ? `Campana: ${selectionLabel} - ${zafra!.nombre} (${cultivo!.nombre}) | Lluvia promedio: ${lluviaPromedio.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm | Eventos: ${filteredEvents.length} | Costo total: $${costoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
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
    cultivo,
    cycleMetrics,
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
        <Card className="mb-6">
          <CardContent className="grid gap-4 p-4 xl:grid-cols-[1.45fr_240px_2.1fr] xl:items-start">
            <div className="space-y-4">
              <div className="space-y-1">
                <CardTitle>Seleccion de Campana</CardTitle>
                <CardDescription>Elija el cultivo, la zafra y las parcelas que desea analizar.</CardDescription>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Select onValueChange={handleCultivoChange} value={selectedCultivoId || ""}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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

              {selectedZafraId ? (
                parcelasDisponibles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border px-3 py-1">{parcelasSeleccionadas.length} seleccionadas</span>
                      <span className="rounded-full border px-3 py-1">{parcelasCerradasSeleccionadas} cerradas</span>
                      <span className="rounded-full border px-3 py-1">{parcelasAbiertasSeleccionadas} abiertas</span>
                      <span className="rounded-full border px-3 py-1">{formatSurface(superficieSeleccionada)} ha</span>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium">Selecciones frecuentes</p>
                          <p className="text-xs text-muted-foreground">
                            Guarde combinaciones de parcelas para reutilizarlas rapido en esta zafra.
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                          <Input
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                            placeholder={defaultPresetName || "Nombre de la seleccion"}
                            className="h-10 sm:w-[240px]"
                            disabled={!hasSelection}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={saveCurrentPreset}
                            disabled={!hasSelection}
                          >
                            <BookmarkPlus className="mr-2 h-4 w-4" />
                            {duplicatePreset ? "Actualizar" : "Guardar"}
                          </Button>
                        </div>
                      </div>

                      {presetsForCurrentZafra.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {presetsForCurrentZafra.map((preset) => {
                            const isActive = haveSameIds(preset.parcelaIds, selectedParcelaIds);
                            const parcelasTexto =
                              preset.parcelaNames.length <= 2
                                ? preset.parcelaNames.join(", ")
                                : `${preset.parcelaNames[0]} + ${preset.parcelaNames.length - 1} mas`;

                            return (
                              <div
                                key={preset.id}
                                className="flex items-center gap-1 rounded-full border bg-background px-1 py-1"
                              >
                                <Button
                                  type="button"
                                  variant={isActive ? "secondary" : "ghost"}
                                  size="sm"
                                  className="h-8 rounded-full px-3"
                                  onClick={() => applySavedPreset(preset)}
                                >
                                  <Bookmark className="mr-2 h-3.5 w-3.5" />
                                  {preset.name}
                                </Button>
                                <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground md:inline">
                                  {parcelasTexto}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => deleteSavedPreset(preset.id)}
                                  aria-label={`Eliminar seleccion ${preset.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Todavia no hay selecciones guardadas para esta zafra.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay parcelas con eventos para la zafra seleccionada.</p>
                )
              ) : null}
            </div>

            <div className="flex min-h-[132px] flex-col justify-between rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lluvia Acumulada</p>
                <CloudRain className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-4xl font-semibold leading-none">
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
                className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4"
              />
            ) : (
              <div className="flex min-h-[132px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Seleccione cultivo, zafra y una o mas parcelas para ver el resumen.
              </div>
            )}
          </CardContent>
        </Card>

        {hasSelection ? (
          <div className="space-y-6">
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

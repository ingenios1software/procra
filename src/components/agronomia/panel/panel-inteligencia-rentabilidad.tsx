"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BadgeDollarSign, Lightbulb, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, formatInteger } from "@/lib/utils";
import type { Cultivo, Zafra } from "@/lib/types";
import type {
  CampaignComparisonSummary,
  ParcelBusinessSummary,
  SelectionBusinessSummary,
  SmartAlert,
} from "./panel-rentabilidad-utils";

interface PanelInteligenciaRentabilidadProps {
  cultivo: Cultivo;
  zafra: Zafra;
  selectionLabel: string;
  selectionSummary: SelectionBusinessSummary;
  parcelSummaries: ParcelBusinessSummary[];
  comparisonSummary?: CampaignComparisonSummary | null;
  alerts: SmartAlert[];
}

function getAlertClassName(level: SmartAlert["level"]) {
  switch (level) {
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "critical":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-sky-200 bg-sky-50 text-sky-900";
  }
}

function getAlertIcon(level: SmartAlert["level"]) {
  switch (level) {
    case "positive":
      return Sparkles;
    case "warning":
    case "critical":
      return AlertTriangle;
    default:
      return Lightbulb;
  }
}

function getMarginTone(value: number) {
  if (value > 10) return "text-emerald-700";
  if (value >= 0) return "text-amber-700";
  return "text-red-700";
}

function renderScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { parcela?: string; x?: number; y?: number; margen?: number } }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold">{point.parcela || "Parcela"}</p>
      <p className="text-muted-foreground">Costo/ha: ${formatCurrency(Number(point.x || 0))}</p>
      <p className="text-muted-foreground">Rendimiento: {formatInteger(Number(point.y || 0))} kg/ha</p>
      <p className={cn("font-medium", Number(point.margen || 0) >= 0 ? "text-emerald-700" : "text-red-700")}>
        Margen/ha: ${formatCurrency(Number(point.margen || 0))}
      </p>
    </div>
  );
}

export function PanelInteligenciaRentabilidad({
  cultivo,
  zafra,
  selectionLabel,
  selectionSummary,
  parcelSummaries,
  comparisonSummary,
  alerts,
}: PanelInteligenciaRentabilidadProps) {
  const hasYieldData = selectionSummary.rendimientoKgHa > 0;
  const ranking = useMemo(() => {
    return [...parcelSummaries].sort((first, second) => {
      if (selectionSummary.rankingCriterion === "margen") {
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
  }, [parcelSummaries, selectionSummary.rankingCriterion]);

  const scatterData = useMemo(
    () =>
      parcelSummaries
        .filter((item) => item.costoPorHa > 0 || item.rendimientoKgHa > 0)
        .map((item) => ({
          x: Number(item.costoPorHa.toFixed(2)),
          y: Number(item.rendimientoKgHa.toFixed(0)),
          z: Math.max(8, Math.round(item.superficie)),
          parcela: item.parcelaNombre,
          margen: item.margenPorHa,
          rendimiento: item.rendimientoKgHa,
        })),
    [parcelSummaries]
  );

  const costAvg = selectionSummary.costoPorHa;
  const yieldAvg = selectionSummary.rendimientoKgHa;
  const bestParcel = selectionSummary.bestParcel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Ejecutivo y Rentabilidad</CardTitle>
        <CardDescription>
          Lectura gerencial para {cultivo.nombre} en {selectionLabel || zafra.nombre}: ingresos estimados, margen, comparacion historica y alertas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ingresos Estimados</p>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold">${formatCurrency(selectionSummary.ingresoTotal)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              ${formatCurrency(selectionSummary.ingresoPorHa)}/ha | {selectionSummary.toneladas.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ton
            </p>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Margen Neto</p>
              <BadgeDollarSign className={cn("h-5 w-5", selectionSummary.margenNeto >= 0 ? "text-emerald-600" : "text-red-600")} />
            </div>
            <p className={cn("mt-3 text-3xl font-semibold", selectionSummary.margenNeto >= 0 ? "text-emerald-700" : "text-red-700")}>
              ${formatCurrency(selectionSummary.margenNeto)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              ${formatCurrency(selectionSummary.margenPorHa)}/ha | ROI {selectionSummary.roiPct.toFixed(1)}%
            </p>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rendimiento</p>
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {hasYieldData ? formatInteger(selectionSummary.rendimientoKgHa) : "--"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasYieldData
                ? `kg/ha | ${selectionSummary.rendimientoTonHa.toFixed(2)} ton/ha`
                : "Se activa al registrar cosecha"}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mix de Costos</p>
              <TrendingDown className="h-5 w-5 text-slate-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold">{selectionSummary.shareServiciosPct.toFixed(0)}%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Servicios | {selectionSummary.shareInsumosPct.toFixed(0)}% insumos
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr_1.05fr]">
          <div className="rounded-xl border bg-muted/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comparacion y mejor parcela</p>
            <h3 className="mt-3 text-2xl font-semibold">
              {comparisonSummary ? comparisonSummary.headline : "Sin campaña comparable"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {comparisonSummary
                ? comparisonSummary.detail
                : "Cuando exista una campaña cerrada previa para las mismas parcelas, el panel mostrara variacion de rendimiento, costo/ha e ingresos."}
            </p>

            <div className="mt-5 rounded-xl border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {selectionSummary.rankingCriterion === "margen" ? "Mejor parcela por margen/ha" : "Parcela mas eficiente en costo"}
              </p>
              {bestParcel ? (
                <>
                  <p className="mt-2 text-xl font-semibold text-primary">{bestParcel.parcelaNombre}</p>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <p>${formatCurrency(bestParcel.margenPorHa)}/ha margen</p>
                    <p>{bestParcel.rendimientoKgHa > 0 ? `${formatInteger(bestParcel.rendimientoKgHa)} kg/ha` : "Sin cosecha cerrada"}</p>
                    <p>${formatCurrency(bestParcel.costoPorHa)}/ha costo</p>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Todavia no hay datos suficientes para identificar una parcela lider.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Costo/ha vs Rendimiento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Detecta parcelas con presion de costo alta y rendimiento bajo frente al promedio.
                </p>
              </div>
            </div>

            {hasYieldData && scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Costo/ha"
                    tickFormatter={(value) => `$${Number(value).toLocaleString("de-DE", { maximumFractionDigits: 0 })}`}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Rendimiento"
                    tickFormatter={(value) => `${Number(value).toLocaleString("de-DE", { maximumFractionDigits: 0 })}`}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={renderScatterTooltip} />
                  <Legend />
                  <ReferenceLine
                    x={costAvg}
                    stroke="hsl(var(--chart-3))"
                    strokeDasharray="4 4"
                    label={{ value: "Costo medio", position: "insideTopRight", fill: "hsl(var(--chart-3))" }}
                  />
                  <ReferenceLine
                    y={yieldAvg}
                    stroke="hsl(var(--chart-1))"
                    strokeDasharray="4 4"
                    label={{ value: "Rendimiento medio", position: "insideBottomRight", fill: "hsl(var(--chart-1))" }}
                  />
                  <Scatter name="Parcelas" data={scatterData} fill="hsl(var(--primary))" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[320px] items-center justify-center text-center text-sm text-muted-foreground">
                El cruce costo/rendimiento se activa cuando la seleccion tenga cosecha valorizada.
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-muted/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Alertas Inteligentes</p>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => {
                const Icon = getAlertIcon(alert.level);
                return (
                  <div key={alert.id} className={cn("rounded-xl border p-4", getAlertClassName(alert.level))}>
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-1 text-sm opacity-90">{alert.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ranking de parcelas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectionSummary.rankingCriterion === "margen"
                  ? "Ordenado por margen por hectarea, para identificar donde realmente queda el lucro."
                  : "Ordenado por costo por hectarea, util cuando la campana aun no cerro cosecha."}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Table resizable className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Rendimiento</TableHead>
                  <TableHead className="text-right">Costo/ha</TableHead>
                  <TableHead className="text-right">Ingreso/ha</TableHead>
                  <TableHead className="text-right">Margen/ha</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((item) => (
                  <TableRow key={item.parcelaId}>
                    <TableCell className="font-medium">{item.parcelaNombre}</TableCell>
                    <TableCell className="text-right">
                      {item.rendimientoKgHa > 0 ? `${formatInteger(item.rendimientoKgHa)} kg/ha` : "-"}
                    </TableCell>
                    <TableCell className="text-right">${formatCurrency(item.costoPorHa)}</TableCell>
                    <TableCell className="text-right">${formatCurrency(item.ingresoPorHa)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", item.margenNeto >= 0 ? "text-emerald-700" : "text-red-700")}>
                      ${formatCurrency(item.margenPorHa)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", getMarginTone(item.margenPct))}>
                      {item.ingresoTotal > 0 ? `${item.margenPct.toFixed(1)}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          item.isClosed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {item.isClosed ? "Cerrada" : "En curso"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

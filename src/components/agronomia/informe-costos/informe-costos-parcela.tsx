
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  Parcela,
  Cultivo,
  Zafra,
  Evento,
  Insumo,
  RegistroLluviaSector,
  Venta,
} from "@/lib/types";
import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { buildLluviaDistribuidaPorParcelaZafra } from "@/lib/lluvias";
import { formatCurrency } from "@/lib/utils";

interface InformeCostosParcelaProps {
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  eventos: Evento[];
  insumos: Insumo[];
  lluviasSector: RegistroLluviaSector[];
  ventas: Venta[];
  isLoading: boolean;
}

interface CostoParcelaData {
    parcela: Parcela;
    cultivo?: Cultivo;
    zafra?: Zafra;
    costoTotal: number;
    costoHa: number;
    rendimiento: number;
    lluviaMm: number | null;
    kgHaPorMm: number | null;
    costoPorTn: number;
    costoProductos: number;
    costoServicios: number;
    eventos: number;
}

function resolveKgFromToneladaLike(totalToneladaLike: number, superficieHa: number): number {
  const totalAsKgFromTon = Math.max(0, totalToneladaLike) * 1000;
  const totalAsKgDirect = Math.max(0, totalToneladaLike);

  if (superficieHa <= 0) return totalAsKgFromTon;

  const rendimientoAsTon = totalAsKgFromTon / superficieHa;
  const rendimientoAsKg = totalAsKgDirect / superficieHa;
  const rangoMinPlausible = 300; // kg/ha
  const rangoMaxPlausible = 30000; // kg/ha

  const tonPlausible = rendimientoAsTon >= rangoMinPlausible && rendimientoAsTon <= rangoMaxPlausible;
  const kgPlausible = rendimientoAsKg >= rangoMinPlausible && rendimientoAsKg <= rangoMaxPlausible;

  if (tonPlausible && !kgPlausible) return totalAsKgFromTon;
  if (!tonPlausible && kgPlausible) return totalAsKgDirect;
  if (tonPlausible && kgPlausible) return totalAsKgFromTon;

  // Si ambos son atípicos, usar el más conservador para evitar valores absurdos.
  return Math.min(totalAsKgFromTon, totalAsKgDirect);
}

function buildAxisDomain(values: number[]): [number, number] {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max <= 0) return [0, 1];

  if (max === min) {
    const pad = Math.max(1, max * 0.2);
    return [Math.max(0, min - pad), max + pad];
  }

  const pad = (max - min) * 0.15;
  return [Math.max(0, min - pad), max + pad];
}

function formatMetric(value?: number | null, digits = 2): string {
  return Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function InformeCostosParcela({
  parcelas,
  cultivos,
  zafras,
  eventos,
  insumos,
  lluviasSector,
  ventas,
  isLoading,
}: InformeCostosParcelaProps) {
  const [selectedCultivoId, setSelectedCultivoId] = useState<string | null>(null);
  const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showTables, setShowTables] = useState(true);
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => {
    if (!selectedCultivoId || !selectedZafraId) return;
    const zafraSeleccionada = zafras.find((z) => z.id === selectedZafraId);
    if (!zafraSeleccionada || zafraSeleccionada.cultivoId !== selectedCultivoId) {
      setSelectedZafraId(null);
    }
  }, [selectedCultivoId, selectedZafraId, zafras]);

  const zafrasFiltradas = useMemo(() => {
    return selectedCultivoId
      ? zafras.filter((z) => z.cultivoId === selectedCultivoId)
      : zafras;
  }, [selectedCultivoId, zafras]);

  const data = useMemo<CostoParcelaData[]>(() => {
    const zafraIdsDelCultivo = selectedCultivoId
      ? new Set(zafras.filter((z) => z.cultivoId === selectedCultivoId).map((z) => z.id))
      : null;
    const selectedZafra = selectedZafraId
      ? zafras.find((z) => z.id === selectedZafraId)
      : undefined;

    const insumosPorId = new Map(insumos.map((insumo) => [insumo.id, insumo]));

    const eventoPasaFiltro = (evento: Evento): boolean => {
      if (selectedZafraId) return evento.zafraId === selectedZafraId;
      if (zafraIdsDelCultivo) return zafraIdsDelCultivo.has(evento.zafraId);
      return true;
    };

    const isEventoRendimiento = (evento: Evento): boolean => {
      const tipo = String(evento.tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return tipo.includes("cosecha") || tipo.includes("rendimiento");
    };

    const parcelasActivas = selectedZafraId
        ? parcelas.filter(p => eventos.some(e => e.parcelaId === p.id && e.zafraId === selectedZafraId))
        : parcelas;
    const lluviaPorParcela = selectedZafraId
      ? new Map(
          buildLluviaDistribuidaPorParcelaZafra(
            parcelasActivas,
            lluviasSector.filter((registro) => registro.zafraId === selectedZafraId)
          ).map((item) => [item.parcelaId, item.milimetros])
        )
      : new Map<string, number>();

    return parcelasActivas.map(parcela => {
        const eventosParcela = eventos.filter((e) => e.parcelaId === parcela.id && eventoPasaFiltro(e));

        const breakdown = eventosParcela.reduce(
          (acc, ev) => {
            const productosDelEvento =
              ev.productos ||
              (ev.insumoId
                ? [{ insumoId: ev.insumoId, cantidad: ev.cantidad || 0, dosis: ev.dosis || 0 }]
                : []);

            const costoProductosCalculado = productosDelEvento.reduce((sumaProductos, prod) => {
              const insumo = prod?.insumoId ? insumosPorId.get(prod.insumoId) : undefined;
              const costoUnitario = Number(insumo?.precioPromedioCalculado ?? insumo?.costoUnitario ?? 0) || 0;
              const cantidad = Number(prod?.cantidad ?? 0) || 0;
              const dosis = Number(prod?.dosis ?? 0) || 0;
              const hectareas = Number(ev.hectareasAplicadas ?? 0) || 0;
              const cantidadFinal = cantidad > 0 ? cantidad : dosis * hectareas;
              return sumaProductos + Math.max(0, cantidadFinal * costoUnitario);
            }, 0);

            const costoServicioExpl = (Number(ev.costoServicioPorHa ?? 0) || 0) * (Number(ev.hectareasAplicadas ?? 0) || 0);
            const costoTotalEvento = Number(ev.costoTotal || 0);

            let costoProductosEvento = 0;
            let costoServiciosEvento = 0;

            if (costoTotalEvento > 0) {
              // Priorizar el servicio explícito cargado en el evento para respetar el dato histórico.
              if (costoServicioExpl > 0) {
                costoServiciosEvento = Math.min(Math.max(0, costoServicioExpl), costoTotalEvento);
                costoProductosEvento = Math.max(0, costoTotalEvento - costoServiciosEvento);
              } else if (costoProductosCalculado > 0) {
                costoProductosEvento = Math.min(costoProductosCalculado, costoTotalEvento);
                costoServiciosEvento = Math.max(0, costoTotalEvento - costoProductosEvento);
              } else {
                costoProductosEvento = costoTotalEvento;
                costoServiciosEvento = 0;
              }
            } else {
              costoProductosEvento = Math.max(0, costoProductosCalculado);
              costoServiciosEvento = Math.max(0, costoServicioExpl);
            }

            const costoEventoFinal = costoTotalEvento > 0 ? costoTotalEvento : costoProductosEvento + costoServiciosEvento;

            acc.costoTotal += costoEventoFinal;
            acc.costoProductos += costoProductosEvento;
            acc.costoServicios += costoServiciosEvento;
            return acc;
          },
          { costoTotal: 0, costoProductos: 0, costoServicios: 0 }
        );

        const costoTotal = breakdown.costoTotal;
        const costoProductos = breakdown.costoProductos;
        const costoServicios = breakdown.costoServicios;
        const costoHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;

        const zafra = selectedZafra;
        const cultivo = zafra?.cultivoId ? cultivos.find((c) => c.id === zafra.cultivoId) : undefined;

        const totalToneladaLikeDesdeEventos = eventosParcela
          .filter((ev) => isEventoRendimiento(ev))
          .reduce((sum, ev) => sum + (Number(ev.toneladas || 0) || 0), 0);
        const totalKgDesdeEventos = resolveKgFromToneladaLike(totalToneladaLikeDesdeEventos, parcela.superficie);

        const totalKg = totalKgDesdeEventos;
        const rendimiento = parcela.superficie > 0 ? totalKg / parcela.superficie : 0;
        const lluviaMm = selectedZafraId ? lluviaPorParcela.get(parcela.id) ?? 0 : null;
        const kgHaPorMm =
          lluviaMm !== null && lluviaMm > 0 ? rendimiento / lluviaMm : null;
        const totalToneladas = totalKg / 1000;
        const costoPorTn = totalToneladas > 0 ? costoTotal / totalToneladas : 0;
        
        return {
            parcela,
            cultivo,
            zafra,
            costoTotal,
            costoHa,
            rendimiento,
            lluviaMm,
            kgHaPorMm,
            costoPorTn,
            costoProductos,
            costoServicios,
            eventos: eventosParcela.length
        }
    }).filter(item => item.costoTotal > 0);
  }, [
    parcelas,
    cultivos,
    zafras,
    eventos,
    insumos,
    lluviasSector,
    selectedCultivoId,
    selectedZafraId,
  ]);

   const columns: ColumnDef<CostoParcelaData>[] = [
    { accessorKey: "parcela.nombre", header: "Parcela" },
    { accessorKey: "parcela.superficie", header: "Superficie (ha)", cell: ({ getValue }) => <div className="text-right">{formatCurrency(getValue<number>())}</div> },
    { accessorKey: "costoTotal", header: "Costo Total ($)", cell: ({ getValue }) => <div className="text-right font-semibold">${formatCurrency(getValue<number>())}</div> },
    { accessorKey: "costoHa", header: "Costo/ha ($)", cell: ({ getValue }) => <div className="text-right font-semibold">${formatCurrency(getValue<number>())}</div> },
    { accessorKey: "rendimiento", header: "Rendimiento (kg/ha)", cell: ({ getValue }) => <div className="text-right">{formatCurrency(getValue<number>())}</div> },
    {
      accessorKey: "lluviaMm",
      header: "Lluvia (mm)",
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.lluviaMm === null ? "-" : formatMetric(row.original.lluviaMm, 1)}
        </div>
      ),
    },
    {
      accessorKey: "kgHaPorMm",
      header: "kg/ha por mm",
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.kgHaPorMm === null ? "-" : formatMetric(row.original.kgHaPorMm, 2)}
        </div>
      ),
    },
    { accessorKey: "costoPorTn", header: "Costo/tn ($)", cell: ({ getValue }) => <div className="text-right text-primary font-bold">${formatCurrency(getValue<number>())}</div> },
    { accessorKey: "eventos", header: "N° Eventos", cell: ({ getValue }) => <div className="text-center">{getValue<number>()}</div> },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const costoHaDomain = useMemo(() => buildAxisDomain(data.map((item) => Number(item.costoHa) || 0)), [data]);
  const rendimientoDomain = useMemo(
    () => buildAxisDomain(data.map((item) => Number(item.rendimiento) || 0)),
    [data]
  );
  const lluviaDomain = useMemo(
    () => buildAxisDomain(data.map((item) => Number(item.lluviaMm) || 0)),
    [data]
  );
  const shareSummary = useMemo(() => {
    const costoTotal = data.reduce((sum, item) => sum + (item.costoTotal || 0), 0);
    const lluviaPromedio =
      selectedZafraId && data.length > 0
        ? data.reduce((sum, item) => sum + (item.lluviaMm || 0), 0) / data.length
        : null;
    return `Parcelas analizadas: ${data.length} | Costo total: $${formatCurrency(costoTotal)}${
      lluviaPromedio !== null ? ` | Lluvia prom.: ${formatMetric(lluviaPromedio, 1)} mm` : ""
    }.`;
  }, [data, selectedZafraId]);
  const costoColor = COMPARATIVE_CHART_COLORS.costo;
  const rendimientoColor = COMPARATIVE_CHART_COLORS.rendimiento;
  const lluviaColor = "hsl(var(--chart-2))";
  const insumosColor = COMPARATIVE_CHART_COLORS.insumos;
  const serviciosColor = COMPARATIVE_CHART_COLORS.servicios;
  const formatPercent = (value: unknown): string => `${Math.round((Number(value) || 0) * 100)}%`;
  const formatPercentLabel = (value: unknown): string => {
    const pct = Number(value) || 0;
    return pct >= 0.08 ? formatPercent(pct) : "";
  };
  const reportTargetId = "informe-costos-parcela-report";

  return (
    <>
      <PageHeader
        title="Informe de Costos por Parcela"
        description="Análisis comparativo de costos, eficiencia y rendimiento entre parcelas."
      >
        <ReportActions
          reportTitle="Informe de Costos por Parcela"
          reportSummary={shareSummary}
          printTargetId={reportTargetId}
          imageTargetId={reportTargetId}
        />
      </PageHeader>
      <div id={reportTargetId} className="print-area space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Seleccione un cultivo y una zafra para acotar el análisis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <Select onValueChange={(v) => setSelectedCultivoId(v === "all" ? null : v)} value={selectedCultivoId || ''}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filtrar por Cultivo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Cultivos</SelectItem>
                {cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => setSelectedZafraId(v === "all" ? null : v)} value={selectedZafraId || ''} disabled={!selectedCultivoId}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filtrar por Zafra..." /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todas las Zafras</SelectItem>
                  {zafrasFiltradas.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="no-print flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setShowTables((prev) => !prev)}>
              {showTables ? "Ocultar tablas" : "Mostrar tablas"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCharts((prev) => !prev)}>
              {showCharts ? "Ocultar graficos" : "Mostrar graficos"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {showTables && (
      <div className="border rounded-lg">
        <Table resizable>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className="cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
            {isLoading && <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Cargando datos...</TableCell></TableRow>}
            {!isLoading && table.getRowModel().rows.length === 0 && <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      )}

      {showCharts && (
      <>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Eficiencia: Costo/ha vs Rendimiento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="parcela.nombre" tickLine={false} />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke={costoColor}
                  domain={costoHaDomain}
                  tick={{ fill: costoColor }}
                  tickLine={false}
                  axisLine={{ stroke: costoColor }}
                  tickFormatter={(value) => `$${formatCurrency(Number(value) || 0)}`}
                  label={{ value: 'Costo/ha ($)', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={rendimientoColor}
                  domain={rendimientoDomain}
                  tick={{ fill: rendimientoColor }}
                  tickLine={false}
                  axisLine={{ stroke: rendimientoColor }}
                  tickFormatter={(value) => `${formatCurrency(Number(value) || 0)} kg/ha`}
                  label={{ value: 'Rendimiento (kg/ha)', angle: 90, position: 'insideRight' }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numeric = Number(value) || 0;
                    if (name === "Costo/ha") return [`$${formatCurrency(numeric)}`, "Costo/ha"];
                    if (name === "Rendimiento") return [`${formatCurrency(numeric)} kg/ha`, "Rendimiento"];
                    return [formatCurrency(numeric), String(name)];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="costoHa"
                  name="Costo/ha"
                  fill={costoColor}
                  fillOpacity={0.45}
                  stroke={costoColor}
                  strokeWidth={1}
                  maxBarSize={56}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rendimiento"
                  name="Rendimiento"
                  stroke={rendimientoColor}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, stroke: rendimientoColor, fill: "hsl(var(--background))" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))", fill: rendimientoColor }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Composición de Costos</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={data.map((item) => ({
                        ...item,
                        pctProductos: item.costoTotal > 0 ? item.costoProductos / item.costoTotal : 0,
                        pctServicios: item.costoTotal > 0 ? item.costoServicios / item.costoTotal : 0,
                      }))}
                      layout="vertical"
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={formatPercent}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis type="category" dataKey="parcela.nombre" width={70} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(value, name, item) => {
                            const pct = Number(value) || 0;
                            const payload = item.payload as CostoParcelaData;
                            const monto = name === "Insumos" ? payload.costoProductos : payload.costoServicios;
                            return [`${(pct * 100).toFixed(2)}% ($${formatCurrency(monto)})`, String(name)];
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="pctProductos"
                          name="Insumos"
                          stackId="a"
                          fill={insumosColor}
                          stroke={insumosColor}
                          strokeWidth={1}
                          radius={[4, 0, 0, 4]}
                        >
                          <LabelList
                            dataKey="pctProductos"
                            position="inside"
                            formatter={formatPercentLabel}
                            fill="hsl(var(--primary-foreground))"
                            fontWeight={600}
                          />
                        </Bar>
                        <Bar
                          dataKey="pctServicios"
                          name="Servicios"
                          stackId="a"
                          fill={serviciosColor}
                          stroke={serviciosColor}
                          strokeWidth={1}
                          radius={[0, 4, 4, 0]}
                        >
                          <LabelList
                            dataKey="pctServicios"
                            position="inside"
                            formatter={formatPercentLabel}
                            fill="hsl(var(--accent-foreground))"
                            fontWeight={600}
                          />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lluvia vs Rendimiento</CardTitle>
          <CardDescription>
            Compara la lluvia acumulada por parcela dentro de la zafra con el
            rendimiento obtenido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedZafraId ? (
            <div className="flex h-[320px] items-center justify-center text-center text-muted-foreground">
              Seleccione una zafra para ver la lluvia acumulada por parcela.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="parcela.nombre" tickLine={false} />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke={lluviaColor}
                  domain={lluviaDomain}
                  tick={{ fill: lluviaColor }}
                  tickLine={false}
                  axisLine={{ stroke: lluviaColor }}
                  tickFormatter={(value) => `${formatMetric(Number(value) || 0, 1)} mm`}
                  label={{ value: "Lluvia (mm)", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={rendimientoColor}
                  domain={rendimientoDomain}
                  tick={{ fill: rendimientoColor }}
                  tickLine={false}
                  axisLine={{ stroke: rendimientoColor }}
                  tickFormatter={(value) => `${formatMetric(Number(value) || 0, 0)} kg/ha`}
                  label={{ value: "Rendimiento (kg/ha)", angle: 90, position: "insideRight" }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numeric = Number(value) || 0;
                    if (name === "Lluvia") {
                      return [`${formatMetric(numeric, 1)} mm`, "Lluvia"];
                    }
                    if (name === "Rendimiento") {
                      return [`${formatMetric(numeric, 0)} kg/ha`, "Rendimiento"];
                    }
                    return [formatMetric(numeric), String(name)];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="lluviaMm"
                  name="Lluvia"
                  fill={lluviaColor}
                  fillOpacity={0.5}
                  stroke={lluviaColor}
                  strokeWidth={1}
                  maxBarSize={56}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rendimiento"
                  name="Rendimiento"
                  stroke={rendimientoColor}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, stroke: rendimientoColor, fill: "hsl(var(--background))" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))", fill: rendimientoColor }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </>
      )}
      </div>
    </>
  );
}

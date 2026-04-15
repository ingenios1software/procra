"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine, LabelList } from "recharts";
import type { Evento, Insumo, Zafra, EtapaCultivo } from "@/lib/types";
import { buildInsumoCostDistribution } from "@/lib/agronomia-cost-distribution";
import { differenceInDays } from "date-fns";
import { getCycleMetrics, getEventCategoryLabel, getEventDate, getSowingBaseDate } from "./panel-evento-utils";
import { formatCurrency } from "@/lib/utils";

const FALLBACK_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface PanelGraficosProps {
    eventos: Evento[];
    insumos: Insumo[];
    zafra: Zafra;
    etapas: EtapaCultivo[];
    parcelaNombre?: string;
}

function formatCostShareLabel(value: unknown): string {
    const pct = Number(value) || 0;
    return pct >= 8 ? `${Math.round(pct)}%` : "";
}

export function PanelGraficos({ eventos, insumos, zafra, etapas, parcelaNombre }: PanelGraficosProps) {
    const fechaBaseSiembra = useMemo(() => getSowingBaseDate(zafra, eventos), [zafra, eventos]);
    const cicloActual = useMemo(() => getCycleMetrics(zafra, eventos), [zafra, eventos]);
    const diasCicloActual = cicloActual.totalDays;

    const {
        distribucionCostos,
        progresoZafraData,
        usandoEventosComoProgreso,
        usandoFrecuenciaEnCostos,
        totalInsumos,
        totalServicios,
        composicionCostos,
    } = useMemo(() => {
        const dataCostosInsumo = buildInsumoCostDistribution(eventos, insumos);
        const costoTotalServicios = dataCostosInsumo
            .filter((item) => item.name === "Servicio")
            .reduce((acc, item) => acc + item.value, 0);
        const costoTotalInsumos = dataCostosInsumo
            .filter((item) => item.name !== "Servicio")
            .reduce((acc, item) => acc + item.value, 0);
        const costoBaseComposicion = costoTotalInsumos + costoTotalServicios;
        const insumosPct = costoBaseComposicion > 0 ? (costoTotalInsumos / costoBaseComposicion) * 100 : 0;
        const serviciosPct = costoBaseComposicion > 0 ? (costoTotalServicios / costoBaseComposicion) * 100 : 0;

        const frecuenciaPorCategoria = eventos.reduce((acc, ev) => {
            const categoria = getEventCategoryLabel(ev);
            acc[categoria] = (acc[categoria] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const dataCostos =
            dataCostosInsumo.length > 0
                ? dataCostosInsumo
                : Object.entries(frecuenciaPorCategoria)
                    .map(([name, value], index) => ({
                        name,
                        value,
                        fill: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                    }))
                    .sort((a, b) => b.value - a.value);

        const etapasCultivo = etapas
            .filter((e) => e.cultivoId === zafra.cultivoId)
            .sort((a, b) => a.orden - b.orden);

        if (etapasCultivo.length > 0) {
            const dataProgreso = etapasCultivo.map((etapa) => {
                const inicio = Math.max(0, etapa.diasDesdeSiembraInicio || 0);
                const fin = Math.max(inicio + 1, etapa.diasDesdeSiembraFin || inicio + 1);
                return {
                    name: etapa.nombre,
                    inicio,
                    duracion: fin - inicio,
                    fin,
                };
            });

            return {
                distribucionCostos: dataCostos,
                progresoZafraData: dataProgreso,
                usandoEventosComoProgreso: false,
                usandoFrecuenciaEnCostos: dataCostosInsumo.length === 0 && eventos.length > 0,
                totalInsumos: costoTotalInsumos,
                totalServicios: costoTotalServicios,
                composicionCostos: [
                    {
                        name: parcelaNombre || zafra.nombre,
                        Insumos: Number(insumosPct.toFixed(2)),
                        Servicios: Number(serviciosPct.toFixed(2)),
                    },
                ],
            };
        }

        const eventosOrdenados = [...eventos]
            .map((ev) => ({ ev, fecha: getEventDate(ev) }))
            .filter((item): item is { ev: Evento; fecha: Date } => !!item.fecha)
            .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

        const dataProgreso = eventosOrdenados.map(({ ev, fecha }, idx) => {
            const inicio = Math.max(0, differenceInDays(fecha, fechaBaseSiembra));
            return {
                name: `${getEventCategoryLabel(ev)} #${idx + 1}`,
                inicio,
                duracion: 1,
                fin: inicio + 1,
            };
        });

        return {
            distribucionCostos: dataCostos,
            progresoZafraData: dataProgreso,
            usandoEventosComoProgreso: true,
            usandoFrecuenciaEnCostos: dataCostosInsumo.length === 0 && eventos.length > 0,
            totalInsumos: costoTotalInsumos,
            totalServicios: costoTotalServicios,
            composicionCostos: [
                {
                    name: parcelaNombre || zafra.nombre,
                    Insumos: Number(insumosPct.toFixed(2)),
                    Servicios: Number(serviciosPct.toFixed(2)),
                },
            ],
        };
    }, [eventos, insumos, etapas, zafra.cultivoId, zafra.nombre, fechaBaseSiembra, parcelaNombre]);

    const hasProgreso = progresoZafraData.length > 0;
    const hasDistribucion = distribucionCostos.length > 0;
    const hasComposicion = composicionCostos.some((item) => item.Insumos > 0 || item.Servicios > 0);
    const totalDistribucion = distribucionCostos.reduce((acc, item) => acc + item.value, 0);

    return (
        <div className="grid gap-6 xl:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle>Ciclo Fenologico del Cultivo</CardTitle>
                    <CardDescription>
                        {usandoEventosComoProgreso
                            ? "No hay etapas configuradas para este cultivo. Mostrando hitos segun eventos cargados."
                            : "Progreso del cultivo a traves de sus etapas fenologicas."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasProgreso ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={progresoZafraData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <XAxis type="number" unit=" dias" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={120} />
                                <Tooltip
                                    formatter={(_, __, item) => {
                                        const payload = item.payload as { inicio: number; fin: number };
                                        return [`${payload.inicio} - ${payload.fin} dias`, "Rango"];
                                    }}
                                />
                                <Legend />
                                <ReferenceLine
                                    x={diasCicloActual}
                                    stroke="hsl(var(--destructive))"
                                    strokeDasharray="4 4"
                                    label={{
                                        value: `${cicloActual.isClosed ? "Cosecha" : "Hoy"} ${diasCicloActual}d`,
                                        fill: "hsl(var(--destructive))",
                                        position: "insideTopRight",
                                    }}
                                />
                                <Bar dataKey="inicio" stackId="rango" fill="transparent" legendType="none" />
                                <Bar
                                    dataKey="duracion"
                                    stackId="rango"
                                    name={usandoEventosComoProgreso ? "Evento (dia)" : "Duracion etapa"}
                                    fill="hsl(var(--primary))"
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            No hay datos suficientes para mostrar el ciclo.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Distribucion de Costos por Categoria</CardTitle>
                    <CardDescription>
                        {usandoFrecuenciaEnCostos
                            ? "Los eventos no tienen costo cargado. Se muestra frecuencia por categoria."
                            : "Costo total por categoria de insumo, con el mismo criterio visual del informe de costos."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasDistribucion ? (
                        <div className="relative h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                    data={distribucionCostos}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={48}
                                    outerRadius={96}
                                    paddingAngle={1}
                                    label={(props) => {
                                        const pct = ((props.percent || 0) * 100);
                                        return pct >= 7 ? `${props.name} ${pct.toFixed(0)}%` : "";
                                    }}
                                    labelLine
                                >
                                    {distribucionCostos.map((item, index) => (
                                        <Cell key={`cell-${index}`} fill={item.fill || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => {
                                        const numeric = Number(value) || 0;
                                        if (usandoFrecuenciaEnCostos) {
                                            return [`${numeric.toLocaleString("de-DE")} evento(s)`, String(name)];
                                        }

                                        const pct = totalDistribucion > 0 ? (numeric / totalDistribucion) * 100 : 0;
                                        return [`$${numeric.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct.toFixed(1)}%)`, String(name)];
                                    }}
                                />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="rounded-full bg-background/90 px-4 py-3 text-center shadow-sm">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        {usandoFrecuenciaEnCostos ? "Eventos" : "Total"}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {usandoFrecuenciaEnCostos
                                            ? totalDistribucion.toLocaleString("de-DE")
                                            : `$${formatCurrency(totalDistribucion)}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            No hay eventos para mostrar distribucion.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Composicion de Costos</CardTitle>
                    <CardDescription>
                        Relacion entre insumos y servicios dentro del costo total de la campana seleccionada.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasComposicion ? (
                        <div className="space-y-4">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={composicionCostos}
                                    layout="vertical"
                                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                                >
                                    <XAxis
                                        type="number"
                                        domain={[0, 100]}
                                        tickFormatter={(value) => `${value}%`}
                                    />
                                    <YAxis type="category" dataKey="name" width={90} />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            const monto = name === "Insumos" ? totalInsumos : totalServicios;
                                            return [`${Number(value).toFixed(1)}% ($${formatCurrency(monto)})`, String(name)];
                                        }}
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey="Insumos"
                                        stackId="costos"
                                        fill="hsl(var(--chart-1))"
                                        radius={[4, 0, 0, 4]}
                                    >
                                        <LabelList
                                            dataKey="Insumos"
                                            position="inside"
                                            formatter={formatCostShareLabel}
                                            fill="#ffffff"
                                            fontSize={13}
                                            fontWeight={700}
                                        />
                                    </Bar>
                                    <Bar
                                        dataKey="Servicios"
                                        stackId="costos"
                                        fill="hsl(var(--chart-3))"
                                        radius={[0, 4, 4, 0]}
                                    >
                                        <LabelList
                                            dataKey="Servicios"
                                            position="inside"
                                            formatter={formatCostShareLabel}
                                            fill="#111827"
                                            fontSize={13}
                                            fontWeight={700}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs font-medium text-muted-foreground">Insumos</p>
                                    <p className="text-xl font-semibold">${formatCurrency(totalInsumos)}</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs font-medium text-muted-foreground">Servicios</p>
                                    <p className="text-xl font-semibold">${formatCurrency(totalServicios)}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            No hay costos suficientes para mostrar la composicion.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


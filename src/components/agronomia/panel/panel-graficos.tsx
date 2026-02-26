"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine } from "recharts";
import type { Evento, Insumo, Zafra, EtapaCultivo } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { getEventCategoryLabel, getEventDate, getSowingBaseDate, groupCostsByEventCategory } from "./panel-evento-utils";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface PanelGraficosProps {
    eventos: Evento[];
    insumos: Insumo[];
    zafra: Zafra;
    etapas: EtapaCultivo[];
}

function normalizeText(value: string): string {
    return (value || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getInsumoCategoryLabel(categoria?: string): string {
    const key = normalizeText(categoria || "");
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

export function PanelGraficos({ eventos, insumos, zafra, etapas }: PanelGraficosProps) {
    const fechaBaseSiembra = useMemo(() => getSowingBaseDate(zafra, eventos), [zafra, eventos]);
    const diasCicloActual = Math.max(0, differenceInDays(new Date(), fechaBaseSiembra));

    const { distribucionCostos, progresoZafraData, usandoEventosComoProgreso, usandoFrecuenciaEnCostos, usandoCategoriasEventoEnCostos } = useMemo(() => {
        const insumosPorId = new Map(insumos.map((insumo) => [insumo.id, insumo]));
        const costosPorCategoriaInsumo = eventos.reduce((acc, ev) => {
            const productosDelEvento =
                ev.productos ||
                (ev.insumoId
                    ? [{ insumoId: ev.insumoId, cantidad: ev.cantidad || 0, dosis: ev.dosis || 0 }]
                    : []);

            let costoProductosEvento = 0;

            for (const prod of productosDelEvento) {
                const insumo = prod?.insumoId ? insumosPorId.get(prod.insumoId) : undefined;
                const categoria = getInsumoCategoryLabel(insumo?.categoria);
                const costoUnitario = Number(insumo?.precioPromedioCalculado ?? insumo?.costoUnitario ?? 0) || 0;
                const cantidadDirecta = Number(prod?.cantidad ?? 0) || 0;
                const cantidadCalculada =
                    cantidadDirecta > 0
                        ? cantidadDirecta
                        : (Number(prod?.dosis ?? 0) || 0) * (Number(ev.hectareasAplicadas ?? 0) || 0);

                const costoProducto = Math.max(0, cantidadCalculada * costoUnitario);
                if (costoProducto <= 0) continue;

                costoProductosEvento += costoProducto;
                acc[categoria] = (acc[categoria] || 0) + costoProducto;
            }

            const costoEvento = Number(ev.costoTotal || 0);
            const costoServicio = costoEvento - costoProductosEvento;
            if (costoServicio > 0.01) {
                acc.Servicio = (acc.Servicio || 0) + costoServicio;
            }

            return acc;
        }, {} as Record<string, number>);

        const dataCostosInsumo = Object.entries(costosPorCategoriaInsumo)
            .map(([name, value]) => ({ name, value }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);

        const costoTotalInsumos = dataCostosInsumo.reduce((acc, item) => acc + item.value, 0);
        const costosPorCategoriaEvento = groupCostsByEventCategory(eventos);
        const costoTotalEventos = costosPorCategoriaEvento.reduce((acc, item) => acc + item.value, 0);

        const frecuenciaPorCategoria = eventos.reduce((acc, ev) => {
            const categoria = getEventCategoryLabel(ev);
            acc[categoria] = (acc[categoria] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const dataCostos =
            costoTotalInsumos > 0
                ? dataCostosInsumo
                : costoTotalEventos > 0
                    ? costosPorCategoriaEvento
                    : Object.entries(frecuenciaPorCategoria).map(([name, value]) => ({ name, value }));

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
                usandoFrecuenciaEnCostos: costoTotalInsumos <= 0 && costoTotalEventos <= 0 && eventos.length > 0,
                usandoCategoriasEventoEnCostos: costoTotalInsumos <= 0 && costoTotalEventos > 0,
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
            usandoFrecuenciaEnCostos: costoTotalInsumos <= 0 && costoTotalEventos <= 0 && eventos.length > 0,
            usandoCategoriasEventoEnCostos: costoTotalInsumos <= 0 && costoTotalEventos > 0,
        };
    }, [eventos, insumos, etapas, zafra.cultivoId, fechaBaseSiembra]);

    const hasProgreso = progresoZafraData.length > 0;
    const hasDistribucion = distribucionCostos.length > 0;

    return (
        <div className="grid gap-6 md:grid-cols-2">
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
                                    label={{ value: `Hoy ${diasCicloActual}d`, fill: "hsl(var(--destructive))", position: "insideTopRight" }}
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
                            : usandoCategoriasEventoEnCostos
                                ? "No hay detalle de insumos suficiente. Se muestra costo por categoria de evento."
                                : "Proporcion de costos por categoria de insumo (herbicidas, fertilizantes, etc.)."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasDistribucion ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                                data={distribucionCostos}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={(props) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                            >
                                {distribucionCostos.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) =>
                                    usandoFrecuenciaEnCostos
                                        ? `${Number(value).toLocaleString("de-DE")} evento(s)`
                                        : `$${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                }
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            No hay eventos para mostrar distribucion.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


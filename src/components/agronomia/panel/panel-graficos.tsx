
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { Evento, Insumo, Zafra, EtapaCultivo } from "@/lib/types";
import { differenceInDays } from "date-fns";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface PanelGraficosProps {
    eventos: Evento[];
    insumos: Insumo[];
    zafra: Zafra;
    etapas: EtapaCultivo[];
}

export function PanelGraficos({ eventos, insumos, zafra, etapas }: PanelGraficosProps) {
    const { distribucionCostos, progresoZafraData } = useMemo(() => {
        const costos = eventos.reduce((acc, ev) => {
            const categoria = ev.categoria || 'Otros';
            acc[categoria] = (acc[categoria] || 0) + (ev.costoTotal || 0);
            return acc;
        }, {} as Record<string, number>);
        const dataCostos = Object.entries(costos).map(([name, value]) => ({ name, value }));

        const fechaSiembra = zafra.fechaSiembra ? new Date(zafra.fechaSiembra) : new Date();
        const dataProgreso = etapas.filter(e => e.cultivoId === zafra.cultivoId).sort((a,b)=> a.orden - b.orden).map(etapa => ({
            name: etapa.nombre,
            dias: [etapa.diasDesdeSiembraInicio, etapa.diasDesdeSiembraFin]
        }));
        
        return {
            distribucionCostos: dataCostos,
            progresoZafraData: dataProgreso,
        };
    }, [eventos, zafra, etapas]);
    
    const diasCicloActual = zafra.fechaSiembra ? differenceInDays(new Date(), new Date(zafra.fechaSiembra)) : 0;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Ciclo Fenológico del Cultivo</CardTitle>
                    <CardDescription>Progreso del cultivo a través de sus etapas fenológicas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={progresoZafraData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" unit=" días" />
                            <YAxis type="category" dataKey="name" width={80} />
                            <Tooltip formatter={(value, name, props) => {
                                if (Array.isArray(value)) return `${value[0]} - ${value[1]} días`;
                                return value;
                            }} />
                            <Legend />
                            <Bar dataKey="dias" name="Duración Etapa" fill="hsl(var(--primary))" barSize={20} />
                             <Bar dataKey="dias" fill="hsl(var(--accent))" barSize={20} >
                                {progresoZafraData.map((entry, index) => {
                                    const duracion = entry.dias[1] - entry.dias[0];
                                    const fin = Math.max(0, Math.min(duracion, diasCicloActual - entry.dias[0]));
                                    const width = (fin / duracion) * 100;
                                    return <Cell key={`cell-${index}`} width={`${width}%`} />
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Distribución de Costos por Categoría</CardTitle>
                    <CardDescription>Proporción de costos totales por categoría de evento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={distribucionCostos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(props) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}>
                            {distribucionCostos.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${Number(value).toLocaleString('en-US')}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}

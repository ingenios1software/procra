"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceArea } from "recharts";
import type { EtapaCultivo } from "@/lib/types";

interface GraficoProyeccionProps {
    historico: number;
    proyectado: number;
    etapas: EtapaCultivo[];
}

export function GraficoProyeccion({ historico, proyectado, etapas }: GraficoProyeccionProps) {
    const { chartData, maxRinde } = useMemo(() => {
        const potencialMaximo = historico * 1.25; // 25% más que el histórico
        const data = [
            { dias: 0, rinde: 0 },
            { dias: 30, rinde: potencialMaximo * 0.1 },
            { dias: 60, rinde: potencialMaximo * 0.8 }, // Punto de máximo potencial
            { dias: 90, rinde: potencialMaximo * 0.95 },
            { dias: 110, rinde: proyectado * 0.98 }, // Ajuste por estrés
            { dias: 130, rinde: proyectado }, // Proyección final
        ];
        return { chartData: data, maxRinde: potencialMaximo };
    }, [historico, proyectado]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Curva de Proyección de Rendimiento</CardTitle>
                <CardDescription>Visualización del rinde potencial vs. el proyectado ajustado por factores.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
                        <XAxis dataKey="dias" unit=" días" label={{ value: "Días desde la siembra", position: 'insideBottom', offset: -20 }} />
                        <YAxis unit=" kg/ha" domain={[0, 'dataMax + 500']} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            formatter={(value: number) => [`${value.toFixed(0)} kg/ha`, "Rinde"]}
                        />
                        <Legend verticalAlign="top" />

                        {etapas.map((etapa, index) => (
                           <ReferenceArea 
                                key={etapa.id}
                                x1={etapa.diasDesdeSiembraInicio} 
                                x2={etapa.diasDesdeSiembraFin} 
                                strokeOpacity={0.3} 
                                fill={index % 2 === 0 ? "hsl(var(--muted))" : "hsl(var(--background))"}
                                label={{ value: etapa.nombre, position: "insideBottom", dy: 20, fill: "hsl(var(--muted-foreground))" }}
                            />
                        ))}
                        
                        <Line type="monotone" dataKey="rinde" name="Rinde Proyectado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        <ReferenceLine y={historico} label={{ value: "Rinde Histórico", position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
                         <ReferenceLine y={maxRinde} label={{ value: "Potencial Máximo", position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--primary))" strokeDasharray="3 3" opacity={0.5} />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

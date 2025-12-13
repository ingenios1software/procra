
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Evento, Insumo } from "@/lib/types";
import { DollarSign, Zap, Calendar, Hash } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PanelAnalisisEconomicoProps {
    eventos: Evento[];
    insumos: Insumo[];
}

export function PanelAnalisisEconomico({ eventos, insumos }: PanelAnalisisEconomicoProps) {
    const { costoTotal, eventoMasCostoso, categoriaMasFrecuente } = useMemo(() => {
        let total = 0;
        let eventoCaro = { nombre: 'N/A', costo: 0 };
        const freqCat: Record<string, number> = {};

        eventos.forEach(ev => {
            const costo = ev.costoTotal || 0;
            total += costo;
            
            if(costo > eventoCaro.costo) {
                eventoCaro = { nombre: ev.categoria || ev.tipo, costo: costo };
            }

            const cat = ev.categoria || 'Otros';
            freqCat[cat] = (freqCat[cat] || 0) + 1;
        });

        const catFrecuente = Object.entries(freqCat).sort((a,b) => b[1] - a[1])[0] || ['N/A', 0];

        return {
            costoTotal: total,
            eventoMasCostoso: eventoCaro,
            categoriaMasFrecuente: catFrecuente[0],
        };
    }, [eventos]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Análisis Económico Rápido</CardTitle>
                <CardDescription>Resumen de los principales indicadores económicos de la campaña.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <DollarSign />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">Total Acumulado</p>
                        <p className="text-sm text-muted-foreground">${formatCurrency(costoTotal)}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <Zap />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">Evento más Costoso</p>
                        <p className="text-sm text-muted-foreground">{eventoMasCostoso.nombre} (${formatCurrency(eventoMasCostoso.costo)})</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <Hash />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">Categoría más Frecuente</p>
                        <p className="text-sm text-muted-foreground">{categoriaMasFrecuente}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <Calendar />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">Proyección Costo Final</p>
                        <p className="text-sm text-muted-foreground">Pendiente</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

    

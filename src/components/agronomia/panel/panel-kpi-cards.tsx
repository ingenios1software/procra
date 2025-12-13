
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays, format } from "date-fns";
import { Calendar, Leaf, Map, Ruler, Activity, Clock, BarChart2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PanelKpiCardsProps {
    parcela: Parcela;
    cultivo: Cultivo;
    zafra: Zafra;
    eventos: Evento[];
}

export function PanelKpiCards({ parcela, cultivo, zafra, eventos }: PanelKpiCardsProps) {
    const { diasDesdeSiembra, eventoReciente, costoTotal, costoPorHa } = useMemo(() => {
        const siembra = zafra.fechaSiembra ? new Date(zafra.fechaSiembra) : null;
        const dias = siembra ? differenceInDays(new Date(), siembra) : 0;
        
        const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;

        const costo = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        const costoHa = parcela.superficie > 0 ? costo / parcela.superficie : 0;

        return {
            diasDesdeSiembra: dias,
            eventoReciente: ultimoEvento,
            costoTotal: costo,
            costoPorHa: costoHa,
        };
    }, [zafra, eventos, parcela.superficie]);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Información General</CardTitle><Calendar/></CardHeader>
                <CardContent>
                    <p className="text-sm"><strong className="text-primary">{zafra.nombre}</strong></p>
                    <p className="text-xs text-muted-foreground">{cultivo.nombre} en {parcela.nombre}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Ciclo a Hoy</CardTitle><Clock/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{diasDesdeSiembra} días</div>
                    <p className="text-xs text-muted-foreground">desde la siembra</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Eventos Totales</CardTitle><Activity/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{eventos.length}</div>
                    <p className="text-xs text-muted-foreground">Último: {eventoReciente?.tipo || 'N/A'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Total / Ha</CardTitle><DollarSign/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${formatCurrency(costoPorHa)}</div>
                    <p className="text-xs text-muted-foreground">Total: ${formatCurrency(costoTotal)}</p>
                </CardContent>
            </Card>
        </div>
    )
}

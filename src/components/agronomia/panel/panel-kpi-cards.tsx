"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { Calendar, Activity, Clock, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getEventCategoryLabel, getSowingBaseDate } from "./panel-evento-utils";

interface PanelKpiCardsProps {
    parcela: Parcela;
    cultivo: Cultivo;
    zafra: Zafra;
    eventos: Evento[];
    className?: string;
}

export function PanelKpiCards({ parcela, cultivo, zafra, eventos, className }: PanelKpiCardsProps) {
    const { diasDesdeSiembra, eventoReciente, costoTotal, costoPorHa } = useMemo(() => {
        const siembra = getSowingBaseDate(zafra, eventos);
        const dias = Math.max(0, differenceInDays(new Date(), siembra));

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
        <div className={className || "grid gap-4 md:grid-cols-2 lg:grid-cols-4"}>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Informacion General</CardTitle><Calendar className="h-5 w-5 text-muted-foreground"/></CardHeader>
                <CardContent>
                    <p className="text-sm"><strong className="text-primary">{zafra.nombre}</strong></p>
                    <p className="text-xs text-muted-foreground">{cultivo.nombre} en {parcela.nombre}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ciclo a Hoy</CardTitle><Clock className="h-5 w-5 text-muted-foreground"/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{diasDesdeSiembra} dias</div>
                    <p className="text-xs text-muted-foreground">desde la siembra</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Eventos Totales</CardTitle><Activity className="h-5 w-5 text-muted-foreground"/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{eventos.length}</div>
                    <p className="text-xs text-muted-foreground">Ultimo: {eventoReciente ? getEventCategoryLabel(eventoReciente) : "N/A"}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costo Total / Ha</CardTitle><DollarSign className="h-5 w-5 text-muted-foreground"/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${formatCurrency(costoPorHa)}</div>
                    <p className="text-xs text-muted-foreground">Total: ${formatCurrency(costoTotal)}</p>
                </CardContent>
            </Card>
        </div>
    )
}

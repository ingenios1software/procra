"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { format } from "date-fns";
import { Calendar, Activity, Clock, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CycleMetrics } from "./panel-evento-utils";
import { getEventCategoryLabel } from "./panel-evento-utils";

interface PanelKpiCardsProps {
    parcelas: Parcela[];
    cultivo: Cultivo;
    zafra: Zafra;
    eventos: Evento[];
    cycleMetrics: CycleMetrics;
    className?: string;
}

function formatSurface(value: number) {
    return value.toLocaleString("de-DE", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

export function PanelKpiCards({ parcelas, cultivo, zafra, eventos, cycleMetrics, className }: PanelKpiCardsProps) {
    const { eventoReciente, costoTotal, costoPorHa, superficieTotal, parcelasLabel } = useMemo(() => {
        const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;
        const costo = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        const superficie = parcelas.reduce((sum, parcela) => sum + (Number(parcela.superficie) || 0), 0);
        const costoHa = superficie > 0 ? costo / superficie : 0;
        const label =
            parcelas.length === 1
                ? parcelas[0].nombre
                : `${parcelas.length} parcelas`;

        return {
            eventoReciente: ultimoEvento,
            costoTotal: costo,
            costoPorHa: costoHa,
            superficieTotal: superficie,
            parcelasLabel: label,
        };
    }, [eventos, parcelas]);

    return (
        <div className={className || "grid gap-3 md:grid-cols-2 lg:grid-cols-4"}>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 pb-1 pt-2.5"><CardTitle className="text-[13px] font-medium">Informacion General</CardTitle><Calendar className="h-4 w-4 text-muted-foreground"/></CardHeader>
                <CardContent className="px-3.5 pb-2.5 pt-0">
                    <p className="text-sm"><strong className="text-primary">{zafra.nombre}</strong></p>
                    <p className="text-[11px] text-muted-foreground">{cultivo.nombre} en {parcelasLabel}</p>
                    <p className="text-[11px] text-muted-foreground">{formatSurface(superficieTotal)} ha seleccionadas</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 pb-1 pt-2.5"><CardTitle className="text-[13px] font-medium">{cycleMetrics.isClosed ? "Ciclo Cerrado" : "Ciclo a Hoy"}</CardTitle><Clock className="h-4 w-4 text-muted-foreground"/></CardHeader>
                <CardContent className="px-3.5 pb-2.5 pt-0">
                    <div className="text-[28px] font-bold leading-none">{cycleMetrics.totalDays} dias</div>
                    <p className="text-[11px] text-muted-foreground">
                        {cycleMetrics.isClosed ? `cerrado el ${format(cycleMetrics.endDate, "dd/MM/yyyy")}` : "desde la siembra"}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 pb-1 pt-2.5"><CardTitle className="text-[13px] font-medium">Eventos Totales</CardTitle><Activity className="h-4 w-4 text-muted-foreground"/></CardHeader>
                <CardContent className="px-3.5 pb-2.5 pt-0">
                    <div className="text-[28px] font-bold leading-none">{eventos.length}</div>
                    <p className="text-[11px] text-muted-foreground">Ultimo: {eventoReciente ? getEventCategoryLabel(eventoReciente) : "N/A"}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 pb-1 pt-2.5"><CardTitle className="text-[13px] font-medium">Costo Total / Ha</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                <CardContent className="px-3.5 pb-2.5 pt-0">
                    <div className="text-[28px] font-bold leading-none">${formatCurrency(costoPorHa)}</div>
                    <p className="text-[11px] text-muted-foreground">Total: ${formatCurrency(costoTotal)}</p>
                </CardContent>
            </Card>
        </div>
    )
}

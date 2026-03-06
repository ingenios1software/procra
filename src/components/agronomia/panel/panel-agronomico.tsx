
"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, EtapaCultivo } from "@/lib/types";
import { PanelKpiCards } from "./panel-kpi-cards";
import { PanelGraficos } from "./panel-graficos";
import { PanelTablaAgronomica } from "./panel-tabla-agronomica";
import { PanelAnalisisEconomico } from "./panel-analisis-economico";
import * as XLSX from 'xlsx';
import { differenceInDays, format } from "date-fns";
import { getEventCategoryLabel, getSowingBaseDate } from "./panel-evento-utils";

interface PanelAgronomicoProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
    insumos: Insumo[];
    etapas: EtapaCultivo[];
}

export function PanelAgronomico({ parcelas, cultivos, zafras, eventos, insumos, etapas }: PanelAgronomicoProps) {
    const [selectedCultivoId, setSelectedCultivoId] = useState<string | null>(null);
    const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
    const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);

    const handleCultivoChange = (cultivoId: string) => {
        setSelectedCultivoId(cultivoId);
        setSelectedZafraId(null);
        setSelectedParcelaId(null);
    }
    
    const handleZafraChange = (zafraId: string) => {
        setSelectedZafraId(zafraId);
        setSelectedParcelaId(null);
    }

    const zafrasFiltradas = useMemo(() => {
        if (!selectedCultivoId) return zafras;
        return zafras.filter(z => z.cultivoId === selectedCultivoId);
    }, [selectedCultivoId, zafras]);
    
    const parcelasFiltradas = useMemo(() => {
        if (!selectedZafraId) return parcelas;
        const parcelasConEventos = new Set(eventos.filter(e => e.zafraId === selectedZafraId).map(e => e.parcelaId));
        return parcelas.filter(p => parcelasConEventos.has(p.id));
    }, [selectedZafraId, eventos, parcelas]);


    const parcela = useMemo(() => parcelas.find(p => p.id === selectedParcelaId), [selectedParcelaId, parcelas]);
    const zafra = useMemo(() => zafras.find(z => z.id === selectedZafraId), [selectedZafraId, zafras]);
    const cultivo = useMemo(() => cultivos.find(c => c.id === zafra?.cultivoId), [zafra, cultivos]);

    const filteredEvents = useMemo(() => {
        if (!parcela || !zafra) return [];
        return eventos.filter(e => e.parcelaId === parcela.id && e.zafraId === zafra.id)
                      .sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }, [parcela, zafra, eventos]);
    
    const { diasDesdeSiembra, costoTotal, costoPorHa } = useMemo(() => {
        if (!zafra || !parcela) return { diasDesdeSiembra: 0, costoTotal: 0, costoPorHa: 0 };
        const siembra = getSowingBaseDate(zafra, filteredEvents);
        const dias = Math.max(0, differenceInDays(new Date(), siembra));
        const costo = filteredEvents.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        const costoHa = parcela.superficie > 0 ? costo / parcela.superficie : 0;
        return { diasDesdeSiembra: dias, costoTotal: costo, costoPorHa: costoHa };
    }, [zafra, parcela, filteredEvents]);
    const shareSummary = parcela && zafra && cultivo
        ? `Campana: ${parcela.nombre} - ${zafra.nombre} (${cultivo.nombre}) | Eventos: ${filteredEvents.length} | Costo total: $${costoTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
        : "Panel agronomico sin seleccion de campana.";


    const exportToExcel = useCallback(() => {
        if (!parcela || !zafra || !cultivo) {
            alert("Por favor, seleccione una parcela y una zafra para exportar.");
            return;
        }

        // 1. Hoja de Resumen
        const resumenData = [
            ["Campaña", `${parcela.nombre} - ${zafra.nombre}`],
            ["Cultivo", cultivo.nombre],
            ["Superficie", `${parcela.superficie} ha`],
            ["Ciclo a Hoy", `${diasDesdeSiembra} días`],
            ["Eventos Totales", filteredEvents.length],
            ["Costo Total Acumulado", `$${costoTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ["Costo por Hectárea", `$${costoPorHa.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.sheet_add_aoa(wsResumen, [["Panel Agronómico - Resumen"]], { origin: "A1"});
        wsResumen['!cols'] = [{ wch: 25 }, { wch: 30 }];


        // 2. Hoja de Costos por Categoría
        const costos = filteredEvents.reduce((acc, ev) => {
            const categoria = getEventCategoryLabel(ev);
            acc[categoria] = (acc[categoria] || 0) + (ev.costoTotal || 0);
            return acc;
        }, {} as Record<string, number>);
        const dataCostos = Object.entries(costos).map(([name, value]) => ({
             Categoría: name, 
             'Costo Total': value,
             'Porcentaje (%)': costoTotal > 0 ? ((value / costoTotal) * 100).toFixed(2) : 0
        }));
        const wsCostos = XLSX.utils.json_to_sheet(dataCostos);
        wsCostos['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];

        // 3. Hoja de Ciclo Fenológico
        const dataProgreso = etapas
            .filter(e => e.cultivoId === zafra.cultivoId)
            .sort((a,b)=> a.orden - b.orden)
            .map(etapa => ({
                'Orden': etapa.orden,
                'Código Etapa': etapa.nombre,
                'Descripción': etapa.descripcion,
                'Inicio (días)': etapa.diasDesdeSiembraInicio,
                'Fin (días)': etapa.diasDesdeSiembraFin
            }));
        const wsCiclo = XLSX.utils.json_to_sheet(dataProgreso);
        wsCiclo['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];

        // 4. Hoja de Eventos
        const eventosData = filteredEvents.map(evento => ({
            'Fecha': format(new Date(evento.fecha), 'dd/MM/yyyy'),
            'Tipo Evento': getEventCategoryLabel(evento),
            'Descripción': evento.descripcion,
            'Costo Evento': evento.costoTotal || 0
        }));
        const wsEventos = XLSX.utils.json_to_sheet(eventosData);
        wsEventos['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }];

        // Crear el libro y agregar las hojas
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
        XLSX.utils.book_append_sheet(wb, wsCostos, "Costos por Categoría");
        XLSX.utils.book_append_sheet(wb, wsCiclo, "Ciclo Fenológico");
        XLSX.utils.book_append_sheet(wb, wsEventos, "Eventos");
        
        // Escribir y descargar el archivo
        XLSX.writeFile(wb, "panel-agronomico.xlsx");
    }, [parcela, zafra, cultivo, filteredEvents, costoTotal, costoPorHa, diasDesdeSiembra, etapas]);

    return (
        <>
            <PageHeader title="Panel Agronómico Inteligente" description="Análisis detallado de la campaña agrícola, desde la siembra hasta la cosecha.">
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" onClick={exportToExcel}><Download className="mr-2"/>Exportar Excel</Button>
                    <ReportActions
                      reportTitle="Panel Agronómico Inteligente"
                      reportSummary={shareSummary}
                      imageTargetId="panel-agronomico-print"
                      printTargetId="panel-agronomico-print"
                    />
                </div>
            </PageHeader>
            <div id="panel-agronomico-print" className="print-area">
                <Card className="mb-6 no-print">
                    <CardHeader>
                        <CardTitle>Selección de Campaña</CardTitle>
                        <CardDescription>Elija el cultivo, la zafra y la parcela que desea analizar.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-4">
                        <Select onValueChange={handleCultivoChange} value={selectedCultivoId || ''}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="1. Seleccione Cultivo..." /></SelectTrigger>
                            <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                         <Select onValueChange={handleZafraChange} value={selectedZafraId || ''} disabled={!selectedCultivoId}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="2. Seleccione Zafra..." /></SelectTrigger>
                            <SelectContent>{zafrasFiltradas.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedParcelaId} value={selectedParcelaId || ''} disabled={!selectedZafraId}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="3. Seleccione Parcela..." /></SelectTrigger>
                            <SelectContent>{parcelasFiltradas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {parcela && zafra && cultivo ? (
                    <div className="space-y-6">
                        <PanelKpiCards parcela={parcela} zafra={zafra} cultivo={cultivo} eventos={filteredEvents} />
                        <PanelGraficos eventos={filteredEvents} insumos={insumos} zafra={zafra} etapas={etapas} />
                        <PanelTablaAgronomica parcela={parcela} zafra={zafra} eventos={filteredEvents} insumos={insumos} />
                        <PanelAnalisisEconomico eventos={filteredEvents} insumos={insumos} />
                    </div>
                ) : (
                    <Card className="flex items-center justify-center h-64 border-dashed no-print">
                        <p className="text-muted-foreground">Por favor, seleccione cultivo, zafra y parcela para comenzar el análisis.</p>
                    </Card>
                )}
            </div>
        </>
    )
}


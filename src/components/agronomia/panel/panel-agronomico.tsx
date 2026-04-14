
"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CloudRain, Download, Eye, EyeOff } from "lucide-react";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, EtapaCultivo, RegistroLluviaSector } from "@/lib/types";
import { PanelKpiCards } from "./panel-kpi-cards";
import { PanelGraficos } from "./panel-graficos";
import { PanelTablaAgronomica } from "./panel-tabla-agronomica";
import { PanelAnalisisEconomico } from "./panel-analisis-economico";
import * as XLSX from 'xlsx';
import { differenceInDays, format } from "date-fns";
import { getEventCategoryLabel, getSowingBaseDate } from "./panel-evento-utils";
import { getLluviaAcumuladaParcelaZafra } from "@/lib/lluvias";

interface PanelAgronomicoProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
    insumos: Insumo[];
    etapas: EtapaCultivo[];
    lluviasSector: RegistroLluviaSector[];
}

export function PanelAgronomico({ parcelas, cultivos, zafras, eventos, insumos, etapas, lluviasSector }: PanelAgronomicoProps) {
    const [selectedCultivoId, setSelectedCultivoId] = useState<string | null>(null);
    const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
    const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);
    const [showDetailedReport, setShowDetailedReport] = useState(true);

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
    
    const { diasDesdeSiembra, costoTotal, costoPorHa, lluviaAcumulada } = useMemo(() => {
        if (!zafra || !parcela) return { diasDesdeSiembra: 0, costoTotal: 0, costoPorHa: 0, lluviaAcumulada: 0 };
        const siembra = getSowingBaseDate(zafra, filteredEvents);
        const dias = Math.max(0, differenceInDays(new Date(), siembra));
        const costo = filteredEvents.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        const costoHa = parcela.superficie > 0 ? costo / parcela.superficie : 0;
        const lluvia = getLluviaAcumuladaParcelaZafra(parcelas, lluviasSector, parcela.id, zafra.id);
        return { diasDesdeSiembra: dias, costoTotal: costo, costoPorHa: costoHa, lluviaAcumulada: lluvia };
    }, [zafra, parcela, filteredEvents, parcelas, lluviasSector]);
    const shareSummary = parcela && zafra && cultivo
        ? `Campana: ${parcela.nombre} - ${zafra.nombre} (${cultivo.nombre}) | Lluvia: ${lluviaAcumulada.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm | Eventos: ${filteredEvents.length} | Costo total: $${costoTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
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
                <Card className="mb-6">
                    <CardContent className="grid gap-4 p-4 xl:grid-cols-[1.35fr_240px_2.15fr] xl:items-start">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <CardTitle>Selección de Campaña</CardTitle>
                                <CardDescription>Elija el cultivo, la zafra y la parcela que desea analizar.</CardDescription>
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <Select onValueChange={handleCultivoChange} value={selectedCultivoId || ''}>
                                    <SelectTrigger><SelectValue placeholder="Cultivo" /></SelectTrigger>
                                    <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select onValueChange={handleZafraChange} value={selectedZafraId || ''} disabled={!selectedCultivoId}>
                                    <SelectTrigger><SelectValue placeholder="Zafra" /></SelectTrigger>
                                    <SelectContent>{zafrasFiltradas.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select onValueChange={setSelectedParcelaId} value={selectedParcelaId || ''} disabled={!selectedZafraId}>
                                    <SelectTrigger><SelectValue placeholder="Parcela" /></SelectTrigger>
                                    <SelectContent>{parcelasFiltradas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex min-h-[132px] flex-col justify-between rounded-xl border bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Lluvia Acumulada
                                </p>
                                <CloudRain className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-4xl font-semibold leading-none">
                                    {parcela && zafra
                                        ? lluviaAcumulada.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
                                        : "--"}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {parcela && zafra ? `mm en ${parcela.nombre}` : "Seleccione una campaña"}
                                </p>
                            </div>
                        </div>

                        {parcela && zafra && cultivo ? (
                            <PanelKpiCards
                                parcela={parcela}
                                zafra={zafra}
                                cultivo={cultivo}
                                eventos={filteredEvents}
                                className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4"
                            />
                        ) : (
                            <div className="flex min-h-[132px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                                Seleccione cultivo, zafra y parcela para ver el resumen.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {parcela && zafra && cultivo ? (
                    <div className="space-y-6">
                        <PanelGraficos
                            eventos={filteredEvents}
                            insumos={insumos}
                            zafra={zafra}
                            etapas={etapas}
                            parcelaNombre={parcela.nombre}
                        />
                        <div className="no-print flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowDetailedReport((prev) => !prev)}
                              aria-expanded={showDetailedReport}
                            >
                              {showDetailedReport ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
                              {showDetailedReport ? "Ocultar Informe Detallado" : "Mostrar Informe Detallado"}
                            </Button>
                        </div>
                        {showDetailedReport && (
                            <PanelTablaAgronomica parcela={parcela} zafra={zafra} eventos={filteredEvents} insumos={insumos} />
                        )}
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


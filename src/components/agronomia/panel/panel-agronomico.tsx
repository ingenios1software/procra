"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, EtapaCultivo } from "@/lib/types";
import { PanelKpiCards } from "./panel-kpi-cards";
import { PanelGraficos } from "./panel-graficos";
import { PanelTablaAgronomica } from "./panel-tabla-agronomica";
import { PanelAnalisisEconomico } from "./panel-analisis-economico";
import { usePrint } from "@/hooks/use-print";

interface PanelAgronomicoProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
    insumos: Insumo[];
    etapas: EtapaCultivo[];
}

export function PanelAgronomico({ parcelas, cultivos, zafras, eventos, insumos, etapas }: PanelAgronomicoProps) {
    const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);
    const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
    const { handlePrint } = usePrint();

    const parcela = useMemo(() => parcelas.find(p => p.id === selectedParcelaId), [selectedParcelaId, parcelas]);
    const zafra = useMemo(() => zafras.find(z => z.id === selectedZafraId), [selectedZafraId, zafras]);
    const cultivo = useMemo(() => cultivos.find(c => c.id === zafra?.cultivoId), [zafra, cultivos]);

    const filteredEvents = useMemo(() => {
        if (!parcela || !zafra) return [];
        return eventos.filter(e => e.parcelaId === parcela.id && e.zafraId === zafra.id)
                      .sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }, [parcela, zafra, eventos]);

    const handleExport = (format: 'pdf' | 'excel') => {
        alert(`Funcionalidad 'Exportar a ${format.toUpperCase()}' pendiente de implementación.`);
    }

    const onPrint = useCallback(() => {
        window.print();
    }, []);

    return (
        <>
            <PageHeader title="Panel Agronómico Inteligente" description="Análisis detallado de la campaña agrícola, desde la siembra hasta la cosecha.">
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" onClick={() => handleExport('excel')}><Download className="mr-2"/>Exportar Excel</Button>
                    <Button variant="outline" onClick={onPrint} type="button"><Printer className="mr-2"/>Imprimir</Button>
                </div>
            </PageHeader>
            <div className="print-area">
                <Card className="mb-6 no-print">
                    <CardHeader>
                        <CardTitle>Selección de Campaña</CardTitle>
                        <CardDescription>Elija la parcela y la zafra que desea analizar.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-4">
                        <Select onValueChange={setSelectedParcelaId} value={selectedParcelaId || ''}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Seleccione Parcela..." /></SelectTrigger>
                            <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                         <Select onValueChange={setSelectedZafraId} value={selectedZafraId || ''}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Seleccione Zafra..." /></SelectTrigger>
                            <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
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
                        <p className="text-muted-foreground">Por favor, seleccione una parcela y una zafra para comenzar el análisis.</p>
                    </Card>
                )}
            </div>
        </>
    )
}

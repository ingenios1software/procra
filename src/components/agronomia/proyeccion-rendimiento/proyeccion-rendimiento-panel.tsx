"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import type { Parcela, Cultivo, Zafra, Evento, EtapaCultivo, Venta } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { FiltrosProyeccion } from "./filtros-proyeccion";
import { MetricasProyeccion } from "./metricas-proyeccion";
import { GraficoProyeccion } from "./grafico-proyeccion";
import { TablaComparativaProyeccion } from "./tabla-comparativa-proyeccion";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ProyeccionRendimientoPanelProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
    etapas: EtapaCultivo[];
    ventasHistoricas: Venta[];
}

export function ProyeccionRendimientoPanel({ parcelas, cultivos, zafras, eventos, etapas, ventasHistoricas }: ProyeccionRendimientoPanelProps) {
    const [filters, setFilters] = useState({
        cultivoId: cultivos[0]?.id || '',
        zafraId: zafras.find(z => z.estado === 'en curso')?.id || '',
        parcelaId: 'all',
        modelo: 'combinado'
    });

    const proyeccionData = useMemo(() => {
        // Lógica de cálculo de proyección (simulada)
        const zafra = zafras.find(z => z.id === filters.zafraId);
        if (!zafra) return [];

        return parcelas.map(parcela => {
            const rendimientoHistorico = (ventasHistoricas
                .filter(v => v.parcelaId === parcela.id && v.cultivoId === filters.cultivoId)
                .reduce((sum, v) => sum + (v.toneladas * 1000 / parcela.superficie), 0)) / 3 || 3500; // kg/ha, promedio de 3 años o default

            let ajuste = 1.0;
            if (filters.modelo === 'fenologico') ajuste = 1.1;
            if (filters.modelo === 'costo/productividad') ajuste = 1.05;

            const proyeccionBase = rendimientoHistorico * ajuste;
            const proyeccionEstimada = proyeccionBase * (1 + Math.random() * 0.1 - 0.05); // +/- 5%

            return {
                parcela,
                rendimientoHistorico: rendimientoHistorico,
                rendimientoAjustado: proyeccionBase,
                proyeccionEstimada: proyeccionEstimada,
            }
        });
    }, [filters, parcelas, zafras, ventasHistoricas]);

    const handleExport = (type: 'pdf' | 'excel' | 'print') => {
        const element = document.getElementById("export-area");
        if (!element) return;

        if (type === 'print') {
            window.print();
            return;
        }

        html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            if (type === 'pdf') {
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF("p", "mm", "a4");
                const imgWidth = 190;
                const pageHeight = 290;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                let heightLeft = imgHeight;
                let position = 10;

                pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
                pdf.save("proyeccion-rendimiento.pdf");
            } else if (type === 'excel') {
                const ws = XLSX.utils.json_to_sheet(proyeccionData.map(p => ({
                    'Parcela': p.parcela.nombre,
                    'Rendimiento Histórico (kg/ha)': p.rendimientoHistorico.toFixed(2),
                    'Proyección Estimada (kg/ha)': p.proyeccionEstimada.toFixed(2)
                })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Proyecciones");
                XLSX.writeFile(wb, "proyeccion-rendimiento.xlsx");
            }
        });
    };

    const selectedParcelaData = useMemo(() => {
        if (filters.parcelaId === 'all') {
            const totalProyectado = proyeccionData.reduce((sum, p) => sum + (p.proyeccionEstimada * p.parcela.superficie), 0);
            return {
                proyeccionEstimada: totalProyectado / parcelas.reduce((s, p) => s + p.superficie, 1), // Promedio ponderado
                produccionTotal: totalProyectado,
            };
        }
        return proyeccionData.find(p => p.parcela.id === filters.parcelaId);
    }, [filters.parcelaId, proyeccionData, parcelas]);

    return (
        <>
            <PageHeader title="Proyección de Rendimiento" description="Análisis predictivo de rendimiento basado en modelos agronómicos.">
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" onClick={() => handleExport('pdf')}><Download className="mr-2"/>Exportar PDF</Button>
                    <Button variant="outline" onClick={() => handleExport('excel')}><Download className="mr-2"/>Exportar Excel</Button>
                    <Button type="button" variant="outline" onClick={() => handleExport('print')}><Printer className="mr-2"/>Imprimir</Button>
                </div>
            </PageHeader>
            <div id="export-area" className="print-area">
                <FiltrosProyeccion 
                    filters={filters} 
                    setFilters={setFilters} 
                    cultivos={cultivos} 
                    zafras={zafras} 
                    parcelas={parcelas}
                />
                
                {selectedParcelaData ? (
                    <div className="space-y-6 mt-6">
                        <MetricasProyeccion data={selectedParcelaData} parcelaId={filters.parcelaId} />
                        
                        {filters.parcelaId !== 'all' && (
                             <GraficoProyeccion 
                                historico={selectedParcelaData.rendimientoHistorico} 
                                proyectado={selectedParcelaData.proyeccionEstimada}
                                etapas={etapas.filter(e => e.cultivoId === filters.cultivoId)}
                            />
                        )}
                       
                        {filters.parcelaId === 'all' && <TablaComparativaProyeccion data={proyeccionData} />}
                    </div>
                ) : (
                    <Card className="mt-6 flex items-center justify-center h-64 border-dashed no-print">
                        <p className="text-muted-foreground">Seleccione filtros para ver la proyección.</p>
                    </Card>
                )}
            </div>
        </>
    )
}

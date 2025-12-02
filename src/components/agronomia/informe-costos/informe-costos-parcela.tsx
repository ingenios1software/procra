
"use client";

import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento, Insumo } from "@/lib/types";
import { differenceInDays, format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from "recharts";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


const DataBar = ({ value, max }: { value: number; max: number }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const showValueInside = percentage > 35;

    if (value === 0) {
        return (
            <div className="flex items-center justify-end pr-2 text-muted-foreground font-mono">
                $0
            </div>
        )
    }

    return (
        <div className="w-full bg-muted/50 dark:bg-muted/30 rounded-sm h-6 relative my-1">
            <div 
                className="bg-primary h-6 rounded-sm flex items-center justify-start" 
                style={{ width: `${percentage}%` }}
            >
               {showValueInside && (
                    <span className="text-xs font-mono font-semibold text-primary-foreground pl-2">
                        ${value.toLocaleString('en-US')}
                    </span>
               )}
            </div>
             {!showValueInside && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-foreground">
                    ${value.toLocaleString('en-US')}
                </span>
            )}
        </div>
    );
};


export function InformeCostosParcela({ parcelas, cultivos, zafras, eventos, insumos }: {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
    insumos: Insumo[];
}) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            const mobile = typeof window !== "undefined" && window.innerWidth < 640;
            setIsMobile(mobile);
        };
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    const chartHeight = isMobile ? 250 : 400;
    const barSize = isMobile ? 15 : 20;
    const tickFont = isMobile ? 10 : 13;
    const labelFont = isMobile ? 10 : 14;

    const [filters, setFilters] = useState({
        cultivoId: '',
        zafraId: '',
        parcelaId: 'all',
        ordenarPor: 'costoTotal',
        orden: 'desc',
    });
     const [columnFilters, setColumnFilters] = useState({
        nombreParcela: "",
        costoProductos: "",
        costoServicios: "",
        costoTotal: "",
        hectareas: "",
        fechaSiembra: "",
        cicloHoy: "",
        costoPromedioHa: "",
        rendimientoHa: "",
        costoPorTon: "",
      });

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const newState = { ...prev, [key]: value };
            if (key === 'cultivoId') {
                newState.zafraId = '';
                newState.parcelaId = 'all';
            }
            if (key === 'zafraId') {
                newState.parcelaId = 'all';
            }
            return newState;
        });
    };
    
    const zafraSeleccionada = useMemo(() => zafras.find(z => z.id === filters.zafraId), [filters.zafraId, zafras]);
    
    const zafrasFiltradas = useMemo(() => {
        if (!filters.cultivoId) return zafras;
        return zafras.filter(z => z.cultivoId === filters.cultivoId);
    }, [filters.cultivoId, zafras]);

    const parcelasFiltradas = useMemo(() => {
        if (!filters.zafraId) return parcelas;
        const parcelasConEventos = new Set(eventos.filter(e => e.zafraId === filters.zafraId).map(e => e.parcelaId));
        return parcelas.filter(p => parcelasConEventos.has(p.id));
    }, [filters.zafraId, eventos, parcelas]);


    const reporteData = useMemo(() => {
        if (!filters.zafraId || !insumos || !zafraSeleccionada) return [];

        let parcelasAnalizadas = filters.parcelaId === 'all' 
            ? parcelasFiltradas
            : parcelasFiltradas.filter(p => p.id === filters.parcelaId);

        let data = parcelasAnalizadas.map(parcela => {
            const eventosParcela = eventos.filter(e => 
                e.parcelaId === parcela.id && 
                e.zafraId === filters.zafraId &&
                (filters.cultivoId ? e.cultivoId === filters.cultivoId : true)
            );

            const eventoSiembra = eventosParcela.find(e => e.tipo === 'siembra');
            const fechaSiembra = eventoSiembra ? new Date(eventoSiembra.fecha as string) : (zafraSeleccionada.fechaSiembra ? new Date(zafraSeleccionada.fechaSiembra as string) : null);
            
            const costoServiciosTotal = eventosParcela.reduce((sum, ev) => sum + ((ev.hectareasAplicadas || 0) * (ev.costoServicioPorHa || 0)), 0);
            
            const costoProductosTotal = eventosParcela.reduce((sum, ev) => {
                 const costoDeEsteEvento = (ev.costoTotal || 0);
                const costoServicioDeEsteEvento = ((ev.hectareasAplicadas || 0) * (ev.costoServicioPorHa || 0));
                const costoProductoDeEsteEvento = costoDeEsteEvento - costoServicioDeEsteEvento;
                return sum + costoProductoDeEsteEvento;
            }, 0);
            
            const costoTotal = costoServiciosTotal + costoProductosTotal;
            const cicloHoy = fechaSiembra ? differenceInDays(new Date(), fechaSiembra) : 0;
            const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
            const totalCosechadoTon = eventosParcela
                .filter(e => e.tipo === 'rendimiento')
                .reduce((sum, ev) => sum + (ev.toneladas || 0), 0);
            
            const rendimientoHa = parcela.superficie > 0 ? totalCosechadoTon / parcela.superficie : 0;
            const costoPorTon = totalCosechadoTon > 0 ? costoTotal / totalCosechadoTon : 0;

            return {
                nombreParcela: parcela.nombre,
                costoProductos: costoProductosTotal,
                costoServicios: costoServiciosTotal,
                costoTotal,
                hectareas: parcela.superficie,
                fechaSiembra: fechaSiembra,
                cicloHoy: cicloHoy,
                costoPromedioHa: costoPorHa,
                rendimientoHa: rendimientoHa,
                costoPorTon: costoPorTon,
            };
        });

        data.sort((a, b) => {
            const valA = a[filters.ordenarPor as keyof typeof a];
            const valB = b[filters.ordenarPor as keyof typeof b];

            if (typeof valA === 'number' && typeof valB === 'number') {
                return filters.orden === 'asc' ? valA - valB : valB - valA;
            }
            if (valA instanceof Date && valB instanceof Date) {
                return filters.orden === 'asc' ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
            }
            if (typeof valA === 'string' && typeof valB === 'string') {
                 return filters.orden === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return 0;
        });

        return data;

    }, [filters, parcelasFiltradas, eventos, zafraSeleccionada, insumos]);

    const filteredRows = useMemo(() => {
        return reporteData.filter(row => {
          return (
            row.nombreParcela.toLowerCase().includes(columnFilters.nombreParcela.toLowerCase()) &&
            row.costoProductos.toString().includes(columnFilters.costoProductos) &&
            row.costoServicios.toString().includes(columnFilters.costoServicios) &&
            row.costoTotal.toString().includes(columnFilters.costoTotal) &&
            row.hectareas.toString().includes(columnFilters.hectareas) &&
            (row.fechaSiembra ? format(row.fechaSiembra, 'dd/MM/yyyy').includes(columnFilters.fechaSiembra) : columnFilters.fechaSiembra === '') &&
            row.cicloHoy.toString().includes(columnFilters.cicloHoy) &&
            row.costoPromedioHa.toString().includes(columnFilters.costoPromedioHa) &&
            row.rendimientoHa.toString().includes(columnFilters.rendimientoHa) &&
            row.costoPorTon.toString().includes(columnFilters.costoPorTon)
          );
        });
    }, [reporteData, columnFilters]);

    const { totales, maxCosto } = useMemo(() => {
        const totalHectareas = filteredRows.reduce((sum, d) => sum + d.hectareas, 0);
        const totalCostoProductos = filteredRows.reduce((sum, d) => sum + d.costoProductos, 0);
        const totalCostoServicios = filteredRows.reduce((sum, d) => sum + d.costoServicios, 0);
        const granTotalCostos = totalCostoProductos + totalCostoServicios;
        
        const costoPromedioGeneral = totalHectareas > 0 ? granTotalCostos / totalHectareas : 0;
        const maxCosto = Math.max(...reporteData.map(d => d.costoTotal), 0);
        const totalCosechadoTonGeneral = filteredRows.reduce((sum, d) => sum + (d.rendimientoHa * d.hectareas), 0);
        const rendimientoPromedioGeneral = totalHectareas > 0 ? totalCosechadoTonGeneral / totalHectareas : 0;
        const costoPorTonPromedioGeneral = totalCosechadoTonGeneral > 0 ? granTotalCostos / totalCosechadoTonGeneral : 0;

        return {
            totales: {
                totalHectareas,
                totalCostoProductos,
                totalCostoServicios,
                granTotalCostos,
                costoPromedioGeneral,
                rendimientoPromedioGeneral,
                costoPorTonPromedioGeneral,
            },
            maxCosto
        }
    }, [filteredRows, reporteData]);
    
    const exportToExcel = () => {
        if (filteredRows.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        const dataForExport = filteredRows.map(row => ({
            'Parcela': row.nombreParcela,
            'Costo Productos ($)': row.costoProductos,
            'Costo Servicios ($)': row.costoServicios,
            'Costo Total ($)': row.costoTotal,
            'Hectáreas': row.hectareas,
            'Fecha Siembra': row.fechaSiembra ? format(row.fechaSiembra, 'dd/MM/yyyy') : 'N/A',
            'Ciclo': row.cicloHoy,
            'Rend. (ton/ha)': row.rendimientoHa,
            'Costo/ha': row.costoPromedioHa,
            'Costo/ton': row.costoPorTon,
        }));
        
        const totalsRow = {
            'Parcela': 'Total General',
            'Costo Productos ($)': totales.totalCostoProductos,
            'Costo Servicios ($)': totales.totalCostoServicios,
            'Costo Total ($)': totales.granTotalCostos,
            'Hectáreas': totales.totalHectareas,
            'Fecha Siembra': '',
            'Ciclo': '',
            'Rend. (ton/ha)': totales.rendimientoPromedioGeneral,
            'Costo/ha': totales.costoPromedioGeneral,
            'Costo/ton': totales.costoPorTonPromedioGeneral,
        }

        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        XLSX.utils.sheet_add_json(worksheet, [totalsRow], { origin: -1, skipHeader: true });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Informe de Costos");
        XLSX.writeFile(workbook, "InformeCostosParcela.xlsx");
    };

    const exportToPDF = async () => {
        const input = document.getElementById('pdf-area');
        if (input) {
            const canvas = await html2canvas(input, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;
            const width = pdfWidth;
            const height = width / ratio;

            if (height > pdfHeight) {
                // Future handling for multi-page PDF if needed
                console.warn("Contenido excede el tamaño de una página PDF.");
            }
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save("InformeCostosParcela.pdf");
        }
    };


    return (
        <>
            <PageHeader
                title="Informe de Costos por Parcela"
                description="Réplica de su informe de Excel para el seguimiento de costos de producción."
            >
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />Exportar Excel</Button>
                    <Button variant="outline" onClick={exportToPDF}><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
                    <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
                </div>
            </PageHeader>

            <div id="pdf-area" className="print-area">
                <Card className="mb-6 no-print">
                    <CardHeader>
                        <CardTitle>Filtros del Informe</CardTitle>
                        <CardDescription>Seleccione los parámetros para generar el reporte.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Select value={filters.cultivoId} onValueChange={(v) => handleFilterChange('cultivoId', v)}>
                            <SelectTrigger><SelectValue placeholder="Seleccione Cultivo" /></SelectTrigger>
                            <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.zafraId} onValueChange={(v) => handleFilterChange('zafraId', v)} disabled={!filters.cultivoId}>
                            <SelectTrigger><SelectValue placeholder="Seleccione Zafra" /></SelectTrigger>
                            <SelectContent>{zafrasFiltradas.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.parcelaId} onValueChange={(v) => handleFilterChange('parcelaId', v)} disabled={!filters.zafraId}>
                            <SelectTrigger><SelectValue placeholder="Seleccione Parcela" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Parcelas (de esta Zafra)</SelectItem>
                                {parcelasFiltradas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                            <div>
                                <CardTitle>Resultados del Informe</CardTitle>
                            </div>
                            <div className="flex items-center gap-2 mt-4 md:mt-0 no-print">
                                <span className="text-sm text-muted-foreground">Ordenar por:</span>
                                <Select value={filters.ordenarPor} onValueChange={(v) => handleFilterChange('ordenarPor', v as typeof filters.ordenarPor)}>
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="costoTotal">Costo Total</SelectItem>
                                        <SelectItem value="costoPromedioHa">Costo/ha</SelectItem>
                                        <SelectItem value="hectareas">Hectárea</SelectItem>
                                        <SelectItem value="fechaSiembra">Fecha Siembra</SelectItem>
                                        <SelectItem value="cicloHoy">Ciclo</SelectItem>
                                        <SelectItem value="rendimientoHa">Rendimiento/ha</SelectItem>
                                        <SelectItem value="costoPorTon">Costo/ton</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filters.orden} onValueChange={(v) => handleFilterChange('orden', v as typeof filters.orden)}>
                                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="desc">Descendente</SelectItem>
                                        <SelectItem value="asc">Ascendente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <Table className="min-w-max whitespace-nowrap">
                                <TableHeader className="sticky top-0 z-40 bg-muted/90 dark:bg-muted/95 backdrop-blur-md supports-[backdrop-filter]:bg-muted/60 shadow-sm border-b border-muted-foreground/20">
                                    <TableRow>
                                        <TableHead className="font-bold text-left px-4 py-2 w-[200px]">Parcela</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2 w-[200px]">Costo Productos ($)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2 w-[200px]">Costo Servicios ($)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2 w-[250px]">Costo Total ($)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Hectáreas</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Fecha Siembra</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Ciclo</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Rend. (ton/ha)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Costo/ha</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Costo/ton</TableHead>
                                    </TableRow>
                                    <TableRow className="bg-muted/50 dark:bg-muted/80 no-print">
                                        <TableHead className="px-2 py-1"><Input className="h-8" placeholder="Filtrar..." value={columnFilters.nombreParcela} onChange={(e) => setColumnFilters(f => ({ ...f, nombreParcela: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoProductos} onChange={(e) => setColumnFilters(f => ({ ...f, costoProductos: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoServicios} onChange={(e) => setColumnFilters(f => ({ ...f, costoServicios: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoTotal} onChange={(e) => setColumnFilters(f => ({ ...f, costoTotal: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.hectareas} onChange={(e) => setColumnFilters(f => ({ ...f, hectareas: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.fechaSiembra} onChange={(e) => setColumnFilters(f => ({ ...f, fechaSiembra: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.cicloHoy} onChange={(e) => setColumnFilters(f => ({ ...f, cicloHoy: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.rendimientoHa} onChange={(e) => setColumnFilters(f => ({ ...f, rendimientoHa: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoPromedioHa} onChange={(e) => setColumnFilters(f => ({ ...f, costoPromedioHa: e.target.value }))} /></TableHead>
                                        <TableHead className="px-2 py-1"><Input className="h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoPorTon} onChange={(e) => setColumnFilters(f => ({ ...f, costoPorTon: e.target.value }))} /></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredRows.map((d, index) => (
                                        <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <TableCell className="px-4 py-3 text-left">{d.nombreParcela}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">${d.costoProductos.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">${d.costoServicios.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <DataBar value={d.costoTotal} max={maxCosto} />
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">{d.hectareas.toLocaleString('en-US')} ha</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">{d.fechaSiembra ? format(d.fechaSiembra, 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">{d.cicloHoy} días</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono font-bold">{d.rendimientoHa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ton/ha</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono font-bold">${d.costoPromedioHa.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono text-accent-foreground dark:text-accent font-semibold">${d.costoPorTon.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-t-2 border-gray-400 dark:border-gray-500">
                                        <TableCell className="px-4 py-3 font-bold text-left">Total General</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.totalCostoProductos.toLocaleString('en-US')}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.totalCostoServicios.toLocaleString('en-US')}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.granTotalCostos.toLocaleString('en-US')}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">{totales.totalHectareas.toLocaleString('en-US')} ha</TableCell>
                                        <TableCell className="px-4 py-3 text-right"></TableCell>
                                        <TableCell className="px-4 py-3 text-right"></TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">{totales.rendimientoPromedioGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ton/ha</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.costoPromedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.costoPorTonPromedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <div className="mt-10 p-4 border rounded-lg bg-background dark:bg-muted/50 space-y-8">
                            <div>
                                <h3 className="text-lg font-bold mb-4">Gráfico de Eficiencia: Costo/ha vs Rendimiento</h3>
                                <div className="w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <ComposedChart data={filteredRows}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="nombreParcela" angle={-20} textAnchor="end" height={80} tick={{ fontSize: tickFont }} />
                                        <YAxis yAxisId="left" label={{ value: 'Costo Promedio ($/ha)', angle: -90, position: 'insideLeft', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }} />
                                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Rendimiento (ton/ha)', angle: 90, position: 'insideRight', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }}/>
                                        <Tooltip 
                                            contentStyle={{ fontSize: tickFont }}
                                            formatter={(value, name) => {
                                                if (name === 'Rendimiento (ton/ha)') {
                                                    return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} ton/ha`;
                                                }
                                                return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: labelFont }} />
                                        <Bar yAxisId="left" dataKey="costoPromedioHa" name="Costo Promedio/ha ($)" fill="#f97316" barSize={barSize} />
                                        <Line yAxisId="right" dataKey="rendimientoHa" name="Rendimiento (ton/ha)" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                             <div>
                                <h3 className="text-lg font-bold mb-4">Gráfico de Composición de Costos</h3>
                                <div className="w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <ComposedChart data={filteredRows}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="nombreParcela" angle={-20} textAnchor="end" height={80} tick={{ fontSize: tickFont }} />
                                            <YAxis label={{ value: 'Costo Total ($)', angle: -90, position: 'insideLeft', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }} />
                                            <Tooltip 
                                                contentStyle={{ fontSize: tickFont }}
                                                formatter={(value) => `$${Number(value).toLocaleString('en-US')}`}
                                            />
                                            <Legend wrapperStyle={{ fontSize: labelFont }} />
                                            <Bar dataKey="costoProductos" name="Costo Productos" stackId="a" fill="hsl(var(--chart-1))" barSize={barSize} />
                                            <Bar dataKey="costoServicios" name="Costo Servicios" stackId="a" fill="hsl(var(--chart-2))" barSize={barSize} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )

}

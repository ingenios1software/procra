
"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface InformeCostosParcelaProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
}

const DataBar = ({ value, max }: { value: number; max: number }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="w-2/5 text-right font-mono">
                {value.toLocaleString('es-AR')} Gs
            </div>
            <div className="w-3/5">
                 <div className="w-full bg-muted rounded-full h-4 relative">
                    <div 
                        className="bg-accent h-4 rounded-full" 
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};


export function InformeCostosParcela({ parcelas, cultivos, zafras, eventos }: InformeCostosParcelaProps) {
    const [filters, setFilters] = useState({
        cultivoId: cultivos[0]?.id || '',
        zafraId: zafras.find(z => z.estado === 'en curso')?.id || '',
        parcelaId: 'all',
    });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };
    
    const zafraSeleccionada = useMemo(() => zafras.find(z => z.id === filters.zafraId), [filters.zafraId, zafras]);

    const reporteData = useMemo(() => {
        const parcelasFiltradas = filters.parcelaId === 'all' 
            ? parcelas 
            : parcelas.filter(p => p.id === filters.parcelaId);

        return parcelasFiltradas.map(parcela => {
            const eventosParcela = eventos.filter(e => 
                e.parcelaId === parcela.id && 
                e.zafraId === filters.zafraId &&
                (filters.cultivoId ? e.cultivoId === filters.cultivoId : true)
            );
            
            const costoTotal = eventosParcela.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
            const cicloHoy = zafraSeleccionada?.fechaSiembra ? differenceInDays(new Date(), new Date(zafraSeleccionada.fechaSiembra)) : 0;
            const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;

            return {
                nombreParcela: parcela.nombre,
                costoProducto: costoTotal,
                hectareas: parcela.superficie,
                cicloHoy: cicloHoy,
                costoPromedioHa: costoPorHa,
            };
        });
    }, [filters, parcelas, eventos, zafraSeleccionada]);

    const { totales, maxCosto } = useMemo(() => {
        const totalHectareas = reporteData.reduce((sum, d) => sum + d.hectareas, 0);
        const totalCostos = reporteData.reduce((sum, d) => sum + d.costoProducto, 0);
        const costoPromedioGeneral = totalHectareas > 0 ? totalCostos / totalHectareas : 0;
        const maxCosto = Math.max(...reporteData.map(d => d.costoProducto), 0);
        
        return {
            totales: {
                totalHectareas,
                totalCostos,
                costoPromedioGeneral
            },
            maxCosto
        }
    }, [reporteData]);


    return (
        <>
            <PageHeader
                title="Informe de Costos por Parcela"
                description="Réplica de su informe de Excel para el seguimiento de costos de producción."
            />
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filtros del Informe</CardTitle>
                    <CardDescription>Seleccione los parámetros para generar el reporte.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select value={filters.cultivoId} onValueChange={(v) => handleFilterChange('cultivoId', v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccione Cultivo" /></SelectTrigger>
                        <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.zafraId} onValueChange={(v) => handleFilterChange('zafraId', v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccione Zafra" /></SelectTrigger>
                        <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.parcelaId} onValueChange={(v) => handleFilterChange('parcelaId', v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccione Parcela" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las Parcelas</SelectItem>
                            {parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resultados del Informe</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="font-bold">Nombre de Parcela</TableHead>
                                <TableHead className="font-bold w-[30%]">Costo en Producto por Parcela (Gs)</TableHead>
                                <TableHead className="text-center font-bold">Hectárea Plantada</TableHead>
                                <TableHead className="text-center font-bold">Ciclo a Hoy</TableHead>
                                <TableHead className="text-center font-bold">Valor Costo por Parcela (Gs)</TableHead>
                                <TableHead className="text-center font-bold">Costo Promedio por Hectárea (Gs/ha)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reporteData.map((data, index) => (
                                <TableRow key={index} className="hover:bg-muted/30">
                                    <TableCell className="font-medium py-2">{data.nombreParcela}</TableCell>
                                    <TableCell className="py-2">
                                        <DataBar value={data.costoProducto} max={maxCosto} />
                                    </TableCell>
                                    <TableCell className="text-center py-2">{data.hectareas} ha</TableCell>
                                    <TableCell className="text-center py-2">{data.cicloHoy} días</TableCell>
                                    <TableCell className="text-center font-semibold font-mono py-2">{data.costoProducto.toLocaleString('es-AR')} Gs</TableCell>
                                    <TableCell className="text-center font-bold font-mono py-2">{data.costoPromedioHa.toLocaleString('es-AR', { maximumFractionDigits: 0 })} Gs</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-amber-100 dark:bg-amber-900/30 border-t-2 border-amber-300 dark:border-amber-700 hover:bg-amber-100/90 dark:hover:bg-amber-900/40">
                                <TableCell className="font-bold text-lg">Total General</TableCell>
                                <TableCell className="font-bold text-lg font-mono text-right">{totales.totalCostos.toLocaleString('es-AR')} Gs</TableCell>
                                <TableCell className="font-bold text-lg font-mono text-center">{totales.totalHectareas} ha</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="font-bold text-lg font-mono text-center">{totales.totalCostos.toLocaleString('es-AR')} Gs</TableCell>
                                <TableCell className="font-bold text-lg font-mono text-center">{totales.costoPromedioGeneral.toLocaleString('es-AR', { maximumFractionDigits: 0 })} Gs</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </>
    );
}


    
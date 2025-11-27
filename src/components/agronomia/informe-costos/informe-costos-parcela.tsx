"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays } from "date-fns";

interface InformeCostosParcelaProps {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
}

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
                costoProducto: costoTotal, // Asumiendo que "Costo en Producto" es el costo total de eventos
                hectareas: parcela.superficie,
                cicloHoy: cicloHoy,
                costoPromedioHa: costoPorHa,
            };
        });
    }, [filters, parcelas, eventos, zafraSeleccionada]);

    const totales = useMemo(() => {
        const totalHectareas = reporteData.reduce((sum, d) => sum + d.hectareas, 0);
        const totalCostos = reporteData.reduce((sum, d) => sum + d.costoProducto, 0);
        const costoPromedioGeneral = totalHectareas > 0 ? totalCostos / totalHectareas : 0;
        
        return {
            totalHectareas,
            totalCostos,
            costoPromedioGeneral
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
                            <TableRow>
                                <TableHead>Nombre de Parcela</TableHead>
                                <TableHead className="text-right">Costo en Producto por Parcela (Gs)</TableHead>
                                <TableHead className="text-right">Hectárea Plantada</TableHead>
                                <TableHead className="text-right">Ciclo a Hoy (días)</TableHead>
                                <TableHead className="text-right">Valor Costo por Parcela (Gs)</TableHead>
                                <TableHead className="text-right">Costo Promedio por Hectárea (Gs/ha)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reporteData.map((data, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{data.nombreParcela}</TableCell>
                                    <TableCell className="text-right">{data.costoProducto.toLocaleString('es-AR')}</TableCell>
                                    <TableCell className="text-right">{data.hectareas}</TableCell>
                                    <TableCell className="text-right">{data.cicloHoy}</TableCell>
                                    <TableCell className="text-right font-semibold">{data.costoProducto.toLocaleString('es-AR')}</TableCell>
                                    <TableCell className="text-right font-bold">{data.costoPromedioHa.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-lg bg-muted">
                                <TableCell>Total General</TableCell>
                                <TableCell className="text-right">{totales.totalCostos.toLocaleString('es-AR')}</TableCell>
                                <TableCell className="text-right">{totales.totalHectareas}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right">{totales.totalCostos.toLocaleString('es-AR')}</TableCell>
                                <TableCell className="text-right">{totales.costoPromedioGeneral.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </>
    );
}


"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FunnelIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const DataBar = ({ value, max }: { value: number; max: number }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const showValueInside = percentage > 35;

    if (value === 0) {
        return (
            <div className="flex items-center justify-end pr-2 text-muted-foreground font-mono">
                0 Gs
            </div>
        )
    }

    return (
        <div className="w-full bg-muted/50 dark:bg-muted/30 rounded-sm h-6 relative my-1">
            <div 
                className="bg-accent h-6 rounded-sm flex items-center justify-start" 
                style={{ width: `${percentage}%` }}
            >
               {showValueInside && (
                    <span className="text-xs font-mono font-semibold text-accent-foreground pl-2">
                        {value.toLocaleString('es-AR')} Gs
                    </span>
               )}
            </div>
             {!showValueInside && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-foreground">
                    {value.toLocaleString('es-AR')} Gs
                </span>
            )}
        </div>
    );
};


export function InformeCostosParcela({ parcelas, cultivos, zafras, eventos }: {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
}) {
    const [filters, setFilters] = useState({
        cultivoId: cultivos[0]?.id || '',
        zafraId: zafras.find(z => z.estado === 'en curso')?.id || '',
        parcelaId: 'all',
        ordenarPor: 'costoPromedioHa',
        orden: 'desc',
    });
     const [columnFilters, setColumnFilters] = useState({
        nombreParcela: "",
        costoProducto: "",
        hectareas: "",
        cicloHoy: "",
        costoPromedioHa: "",
      });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };
    
    const zafraSeleccionada = useMemo(() => zafras.find(z => z.id === filters.zafraId), [filters.zafraId, zafras]);

    const reporteData = useMemo(() => {
        let parcelasFiltradas = filters.parcelaId === 'all' 
            ? parcelas 
            : parcelas.filter(p => p.id === filters.parcelaId);

        let data = parcelasFiltradas.map(parcela => {
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

        data.sort((a, b) => {
            const valA = a[filters.ordenarPor as keyof typeof a];
            const valB = b[filters.ordenarPor as keyof typeof b];

            if (typeof valA === 'number' && typeof valB === 'number') {
                return filters.orden === 'asc' ? valA - valB : valB - valA;
            }
            if (typeof valA === 'string' && typeof valB === 'string') {
                 return filters.orden === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return 0;
        });

        return data;

    }, [filters, parcelas, eventos, zafraSeleccionada]);

    const filteredRows = useMemo(() => {
        return reporteData.filter(row => {
          return (
            row.nombreParcela.toLowerCase().includes(columnFilters.nombreParcela.toLowerCase()) &&
            row.costoProducto.toString().includes(columnFilters.costoProducto) &&
            row.hectareas.toString().includes(columnFilters.hectareas) &&
            row.cicloHoy.toString().includes(columnFilters.cicloHoy) &&
            row.costoPromedioHa.toString().includes(columnFilters.costoPromedioHa)
          );
        });
    }, [reporteData, columnFilters]);

    const { totales, maxCosto } = useMemo(() => {
        const totalHectareas = filteredRows.reduce((sum, d) => sum + d.hectareas, 0);
        const totalCostos = filteredRows.reduce((sum, d) => sum + d.costoProducto, 0);
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
    }, [filteredRows, reporteData]);

    const exportToExcel = () => {
        alert("La exportación a Excel con formato de estilos no está implementada.");
    }


    return (
        <>
            <PageHeader
                title="Informe de Costos por Parcela"
                description="Réplica de su informe de Excel para el seguimiento de costos de producción."
            >
                 <Button variant="outline" onClick={exportToExcel}>Exportar Excel</Button>
            </PageHeader>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filtros del Informe</CardTitle>
                    <CardDescription>Seleccione los parámetros para generar el reporte.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <CardTitle>Resultados del Informe</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <span className="text-sm text-muted-foreground">Ordenar por:</span>
                             <Select value={filters.ordenarPor} onValueChange={(v) => handleFilterChange('ordenarPor', v)}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="costoPromedioHa">Costo/ha</SelectItem>
                                    <SelectItem value="costoProducto">Costo Total</SelectItem>
                                    <SelectItem value="hectareas">Hectárea</SelectItem>
                                    <SelectItem value="cicloHoy">Ciclo</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filters.orden} onValueChange={(v) => handleFilterChange('orden', v)}>
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
                    <div className="relative max-h-[480px] overflow-y-auto border border-gray-200 rounded-lg">
                        <Table className="min-w-max whitespace-nowrap">
                            <TableHeader className="sticky top-0 z-20 bg-muted dark:bg-muted/95">
                                <TableRow>
                                    <TableHead className="font-bold text-left">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className="flex items-center gap-1">
                                                Nombre de Parcela <ChevronDown className="h-4 w-4" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem>Orden Ascendente</DropdownMenuItem>
                                                <DropdownMenuItem>Orden Descendente</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableHead>
                                    <TableHead className="font-bold text-right w-[250px]">Costo en Producto por Parcela (Gs)</TableHead>
                                    <TableHead className="text-right font-bold">Hectárea Plantada</TableHead>
                                    <TableHead className="text-right font-bold">Ciclo a Hoy</TableHead>
                                    <TableHead className="text-right font-bold">Costo Promedio por Hectárea (Gs/ha)</TableHead>
                                </TableRow>
                                 <TableRow className="bg-muted/50 dark:bg-muted/80">
                                    <TableHead className="px-4 py-2">
                                        <Input className="w-full rounded border px-2 py-1 text-xs h-8" placeholder="Filtrar..." value={columnFilters.nombreParcela} onChange={(e) => setColumnFilters(f => ({ ...f, nombreParcela: e.target.value }))} />
                                    </TableHead>
                                     <TableHead className="px-4 py-2">
                                        <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoProducto} onChange={(e) => setColumnFilters(f => ({ ...f, costoProducto: e.target.value }))} />
                                    </TableHead>
                                    <TableHead className="px-4 py-2">
                                        <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right" placeholder="Filtrar..." value={columnFilters.hectareas} onChange={(e) => setColumnFilters(f => ({ ...f, hectareas: e.target.value }))} />
                                    </TableHead>
                                    <TableHead className="px-4 py-2">
                                        <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right" placeholder="Filtrar..." value={columnFilters.cicloHoy} onChange={(e) => setColumnFilters(f => ({ ...f, cicloHoy: e.target.value }))} />
                                    </TableHead>
                                    <TableHead className="px-4 py-2">
                                        <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right" placeholder="Filtrar..." value={columnFilters.costoPromedioHa} onChange={(e) => setColumnFilters(f => ({ ...f, costoPromedioHa: e.target.value }))} />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.map((data, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50 dark:hover:bg-muted/60">
                                        <TableCell className="font-medium py-3 text-left">{data.nombreParcela}</TableCell>
                                        <TableCell className="py-1 text-right">
                                            <DataBar value={data.costoProducto} max={maxCosto} />
                                        </TableCell>
                                        <TableCell className="text-right py-3 font-mono">{data.hectareas} ha</TableCell>
                                        <TableCell className="text-right py-3 font-mono">{data.cicloHoy} días</TableCell>
                                        <TableCell className="text-right font-bold font-mono py-3">{data.costoPromedioHa.toLocaleString('es-AR', { maximumFractionDigits: 0 })} Gs</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-amber-100 dark:bg-amber-900/50 border-t-2 border-amber-300 dark:border-amber-800 hover:bg-amber-100/90 dark:hover:bg-amber-900/60">
                                    <TableCell className="font-bold text-lg text-left">Total General</TableCell>
                                    <TableCell className="font-bold text-lg font-mono text-right">{totales.totalCostos.toLocaleString('es-AR')} Gs</TableCell>
                                    <TableCell className="font-bold text-lg font-mono text-right">{totales.totalHectareas} ha</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="font-bold text-lg font-mono text-right">{totales.costoPromedioGeneral.toLocaleString('es-AR', { maximumFractionDigits: 0 })} Gs</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

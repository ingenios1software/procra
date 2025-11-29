
"use client";

import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line, BarChart, Scatter } from "recharts";

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
                className="bg-accent h-6 rounded-sm flex items-center justify-start" 
                style={{ width: `${percentage}%` }}
            >
               {showValueInside && (
                    <span className="text-xs font-mono font-semibold text-accent-foreground pl-2">
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


export function InformeCostosParcela({ parcelas, cultivos, zafras, eventos }: {
    parcelas: Parcela[];
    cultivos: Cultivo[];
    zafras: Zafra[];
    eventos: Evento[];
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
        ordenarPor: 'costoPromedioHa',
        orden: 'desc',
    });
     const [columnFilters, setColumnFilters] = useState({
        nombreParcela: "",
        costoProducto: "",
        hectareas: "",
        cicloHoy: "",
        costoPromedioHa: "",
        rendimientoHa: "",
        costoKg: "",
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
        if (!filters.zafraId) return [];

        let parcelasAnalizadas = filters.parcelaId === 'all' 
            ? parcelasFiltradas
            : parcelasFiltradas.filter(p => p.id === filters.parcelaId);

        let data = parcelasAnalizadas.map(parcela => {
            const eventosParcela = eventos.filter(e => 
                e.parcelaId === parcela.id && 
                e.zafraId === filters.zafraId &&
                (filters.cultivoId ? e.cultivoId === filters.cultivoId : true)
            );
            
            const costoTotal = eventosParcela.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
            const cicloHoy = zafraSeleccionada?.fechaSiembra ? differenceInDays(new Date(), new Date(zafraSeleccionada.fechaSiembra as string)) : 0;
            const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
            const totalCosechadoKg = eventosParcela
                .filter(e => e.tipo === 'rendimiento')
                .reduce((sum, ev) => sum + ((ev.toneladas || 0) * 1000), 0);
            
            const rendimientoHa = parcela.superficie > 0 ? totalCosechadoKg / parcela.superficie : 0;
            const costoKg = totalCosechadoKg > 0 ? costoTotal / totalCosechadoKg : 0;

            return {
                nombreParcela: parcela.nombre,
                costoProducto: costoTotal,
                hectareas: parcela.superficie,
                cicloHoy: cicloHoy,
                costoPromedioHa: costoPorHa,
                rendimientoHa: rendimientoHa,
                costoKg: costoKg,
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

    }, [filters, parcelasFiltradas, eventos, zafraSeleccionada]);

    const filteredRows = useMemo(() => {
        return reporteData.filter(row => {
          return (
            row.nombreParcela.toLowerCase().includes(columnFilters.nombreParcela.toLowerCase()) &&
            row.costoProducto.toString().includes(columnFilters.costoProducto) &&
            row.hectareas.toString().includes(columnFilters.hectareas) &&
            row.cicloHoy.toString().includes(columnFilters.cicloHoy) &&
            row.costoPromedioHa.toString().includes(columnFilters.costoPromedioHa) &&
            row.rendimientoHa.toString().includes(columnFilters.rendimientoHa) &&
            row.costoKg.toString().includes(columnFilters.costoKg)
          );
        });
    }, [reporteData, columnFilters]);

    const { totales, maxCosto } = useMemo(() => {
        const totalHectareas = filteredRows.reduce((sum, d) => sum + d.hectareas, 0);
        const totalCostos = filteredRows.reduce((sum, d) => sum + d.costoProducto, 0);
        const costoPromedioGeneral = totalHectareas > 0 ? totalCostos / totalHectareas : 0;
        const maxCosto = Math.max(...reporteData.map(d => d.costoProducto), 0);
        const totalCosechadoKgGeneral = filteredRows.reduce((sum, d) => sum + (d.rendimientoHa * d.hectareas), 0);
        const rendimientoPromedioGeneral = totalHectareas > 0 ? totalCosechadoKgGeneral / totalHectareas : 0;
        const costoKgPromedioGeneral = totalCosechadoKgGeneral > 0 ? totalCostos / totalCosechadoKgGeneral : 0;

        return {
            totales: {
                totalHectareas,
                totalCostos,
                costoPromedioGeneral,
                rendimientoPromedioGeneral,
                costoKgPromedioGeneral,
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
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={exportToExcel}>Exportar Excel</Button>
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
                            <div className="flex items-center gap-2 mt-4 md:mt-0">
                                <span className="text-sm text-muted-foreground">Ordenar por:</span>
                                <Select value={filters.ordenarPor} onValueChange={(v) => handleFilterChange('ordenarPor', v as typeof filters.ordenarPor)}>
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="costoPromedioHa">Costo/ha</SelectItem>
                                        <SelectItem value="costoProducto">Costo Total</SelectItem>
                                        <SelectItem value="hectareas">Hectárea</SelectItem>
                                        <SelectItem value="cicloHoy">Ciclo</SelectItem>
                                        <SelectItem value="rendimientoHa">Rendimiento/ha</SelectItem>
                                        <SelectItem value="costoKg">Costo/kg</SelectItem>
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
                                <TableHeader className="sticky top-0 z-40 
           bg-muted/90 dark:bg-muted/95 
           backdrop-blur-md 
           supports-[backdrop-filter]:bg-muted/60 
           shadow-md 
           border-b border-muted-foreground/20">
                                    <TableRow>
                                        <TableHead className="font-bold text-left px-4 py-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="flex items-center gap-1">
                                                    Nombre de Parcela <ChevronDown className="h-4 w-4" />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => { handleFilterChange('ordenarPor', 'nombreParcela'); handleFilterChange('orden', 'asc'); }}>Orden Ascendente</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { handleFilterChange('ordenarPor', 'nombreParcela'); handleFilterChange('orden', 'desc'); }}>Orden Descendente</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2 w-[250px]">Costo en Producto por Parcela ($)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Hectárea Plantada</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Ciclo a Hoy</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Rendimiento (kg/ha)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Costo Promedio por Hectárea ($/ha)</TableHead>
                                        <TableHead className="font-bold text-right px-4 py-2">Costo/kg Producido ($)</TableHead>
                                    </TableRow>
                                    <TableRow className="bg-muted/50 dark:bg-muted/80">
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.nombreParcela} onChange={(e) => setColumnFilters(f => ({ ...f, nombreParcela: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.costoProducto} onChange={(e) => setColumnFilters(f => ({ ...f, costoProducto: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.hectareas} onChange={(e) => setColumnFilters(f => ({ ...f, hectareas: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.cicloHoy} onChange={(e) => setColumnFilters(f => ({ ...f, cicloHoy: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.rendimientoHa} onChange={(e) => setColumnFilters(f => ({ ...f, rendimientoHa: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.costoPromedioHa} onChange={(e) => setColumnFilters(f => ({ ...f, costoPromedioHa: e.target.value }))} />
                                        </TableHead>
                                        <TableHead className="px-2 py-1">
                                            <Input className="w-full rounded border px-2 py-1 text-xs h-8 text-right bg-background dark:bg-card" placeholder="Filtrar..." value={columnFilters.costoKg} onChange={(e) => setColumnFilters(f => ({ ...f, costoKg: e.target.value }))} />
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredRows.map((d, index) => (
                                        <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <TableCell className="px-4 py-3 text-left">{d.nombreParcela}</TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <DataBar value={d.costoProducto} max={maxCosto} />
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">{d.hectareas.toLocaleString('en-US')} ha</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono">{d.cicloHoy} días</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono font-bold">{d.rendimientoHa.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg/ha</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono font-bold">${d.costoPromedioHa.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono text-accent-foreground dark:text-accent font-semibold">${d.costoKg.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-t-2 border-gray-400 dark:border-gray-500">
                                        <TableCell className="px-4 py-3 font-bold text-left">Total General</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.totalCostos.toLocaleString('en-US')}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">{totales.totalHectareas.toLocaleString('en-US')} ha</TableCell>
                                        <TableCell className="px-4 py-3 text-right"></TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">{totales.rendimientoPromedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg/ha</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.costoPromedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold">${totales.costoKgPromedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <div className="mt-10 p-4 border rounded-lg bg-background dark:bg-muted/50 space-y-8">
                            <div>
                                <h3 className="text-lg font-bold mb-4">Gráfico de Eficiencia: Costo/ha vs Rendimiento</h3>
                                <div className="w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart data={filteredRows}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="nombreParcela" angle={-20} textAnchor="end" height={80} tick={{ fontSize: tickFont }} />
                                        <YAxis yAxisId="left" label={{ value: 'Costo Promedio ($/ha)', angle: -90, position: 'insideLeft', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }} />
                                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Rendimiento (kg/ha)', angle: 90, position: 'insideRight', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }}/>
                                        <Tooltip 
                                            contentStyle={{ fontSize: tickFont }}
                                            formatter={(value, name) => {
                                                if (name === 'Rendimiento (kg/ha)') {
                                                    return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })} kg/ha`;
                                                }
                                                return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: labelFont }} />
                                        <Bar yAxisId="left" dataKey="costoPromedioHa" name="Costo Promedio/ha ($)" fill="#f97316" barSize={barSize} />
                                        <Bar yAxisId="right" dataKey="rendimientoHa" name="Rendimiento (kg/ha)" fill="#16a34a" barSize={barSize} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                             <div>
                                <h3 className="text-lg font-bold mb-4">Gráfico de Magnitud: Costo Total vs Hectáreas</h3>
                                <div className="w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart data={filteredRows}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="nombreParcela" angle={-20} textAnchor="end" height={80} tick={{ fontSize: tickFont }} />
                                            <YAxis yAxisId="left" orientation="left" label={{ value: 'Costo Total ($)', angle: -90, position: 'insideLeft', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }} />
                                            <YAxis yAxisId="right" orientation="right" label={{ value: 'Hectáreas', angle: 90, position: 'insideRight', style: { fontSize: labelFont } }} tick={{ fontSize: tickFont }} />
                                            <Tooltip 
                                                contentStyle={{ fontSize: tickFont }}
                                                formatter={(value, name) => {
                                                    if (name === 'Hectáreas') {
                                                        return `${Number(value).toLocaleString('en-US')} ha`;
                                                    }
                                                    return `$${Number(value).toLocaleString('en-US')}`;
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: labelFont }} />
                                            <Bar yAxisId="left" dataKey="costoProducto" name="Costo Total" fill="#3b82f6" barSize={barSize} />
                                            <Bar yAxisId="right" dataKey="hectareas" name="Hectáreas" fill="#ef4444" barSize={barSize} />
                                        </BarChart>
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

"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento, Insumo } from "@/lib/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line, PieChart, Pie, Cell } from "recharts";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { DollarSign, AreaChart, Tractor, Sprout, TrendingDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8442ff", "#ff4284"];


export default function InformeCostosPage() {
    const firestore = useFirestore();

    const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]));
    const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null, [firestore]));
    const { data: zafras, isLoading: l3 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]));
    const { data: todosEventos, isLoading: l4 } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha')) : null, [firestore]));
    const { data: insumos, isLoading: l5 } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos')) : null, [firestore]));

    const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);

    const isLoading = l1 || l2 || l3 || l4 || l5;

    const reporteData = useMemo(() => {
        if (!selectedZafraId || !zafras || !parcelas || !todosEventos || !insumos) return null;

        const zafra = zafras.find(z => z.id === selectedZafraId);
        if (!zafra) return null;

        const eventosZafra = todosEventos.filter(e => e.zafraId === selectedZafraId);
        const parcelasIdsEnZafra = [...new Set(eventosZafra.map(e => e.parcelaId))];
        const parcelasEnZafra = parcelas.filter(p => parcelasIdsEnZafra.includes(p.id));
        const superficieTotal = parcelasEnZafra.reduce((sum, p) => sum + p.superficie, 0);

        const costoTotal = eventosZafra.reduce((sum, e) => sum + (e.costoTotal || 0), 0);
        const costoPorHa = superficieTotal > 0 ? costoTotal / superficieTotal : 0;
        
        const totalServicios = eventosZafra.reduce((sum, e) => sum + ((e.hectareasAplicadas || 0) * (e.costoServicioPorHa || 0)), 0);
        const totalInsumos = costoTotal - totalServicios;
        
        const costosPorCategoriaInsumo = eventosZafra.flatMap(e => e.productos || []).reduce((acc, prod) => {
            const insumo = insumos.find(i => i.id === prod.insumoId);
            if (!insumo) return acc;
            const categoria = insumo.categoria || 'otros';
            const costo = prod.cantidad * (insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
            acc[categoria] = (acc[categoria] || 0) + costo;
            return acc;
        }, {} as Record<string, number>);

        const costosPorCategoriaData = Object.entries(costosPorCategoriaInsumo).map(([name, value]) => ({ name, value, label: `${((value/totalInsumos)*100).toFixed(0)}%` }));

        const costoAcumulado = eventosZafra.sort((a,b) => new Date(a.fecha as string).getTime() - new Date(b.fecha as string).getTime()).reduce((acc, evento) => {
            const fecha = format(new Date(evento.fecha as string), "dd/MM");
            const costo = evento.costoTotal || 0;
            const ultimo = acc.length > 0 ? acc[acc.length - 1] : { fecha: '', costo: 0 };
            acc.push({ fecha, costo: ultimo.costo + costo });
            return acc;
        }, [] as { fecha: string, costo: number }[]);
        
        const topInsumos = Object.entries(eventosZafra.flatMap(e => e.productos || []).reduce((acc, prod) => {
            const insumo = insumos.find(i => i.id === prod.insumoId);
            if (!insumo) return acc;
            const costo = prod.cantidad * (insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
            if (!acc[insumo.nombre]) acc[insumo.nombre] = { cantidad: 0, costo: 0, unidad: insumo.unidad };
            acc[insumo.nombre].cantidad += prod.cantidad;
            acc[insumo.nombre].costo += costo;
            return acc;
        }, {} as Record<string, { cantidad: number, costo: number, unidad: string }>)).map(([nombre, data]) => ({ nombre, ...data })).sort((a,b) => b.costo - a.costo).slice(0, 10);

        const costosPorParcela = parcelasEnZafra.map(p => {
            const costoParcela = eventosZafra.filter(e => e.parcelaId === p.id).reduce((sum, e) => sum + (e.costoTotal || 0), 0);
            return {
                ...p,
                costoTotal: costoParcela,
                costoPorHa: p.superficie > 0 ? costoParcela / p.superficie : 0,
                porcentaje: costoTotal > 0 ? (costoParcela / costoTotal) * 100 : 0,
            }
        }).sort((a,b) => b.costoTotal - a.costoTotal);
        
        return { zafra, superficieTotal, costoTotal, costoPorHa, totalInsumos, totalServicios, eventosCount: eventosZafra.length, costosPorCategoriaData, costoAcumulado, topInsumos, costosPorParcela };

    }, [selectedZafraId, zafras, parcelas, todosEventos, insumos]);

    if (isLoading) {
        return <p>Cargando datos para el informe de costos...</p>;
    }
    
    return (
        <div id="pdf-area" className="print-area">
            <PageHeader
                title="Reporte Final de Costo de Producción"
                description="Análisis consolidado a nivel de zafra."
            >
                <div className="flex items-center gap-4 no-print">
                    <Select onValueChange={setSelectedZafraId} value={selectedZafraId || ""}>
                        <SelectTrigger className="w-[300px]"><SelectValue placeholder="Seleccione una zafra para el reporte" /></SelectTrigger>
                        <SelectContent>{zafras?.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </PageHeader>
            {!selectedZafraId || !reporteData ? (
                 <Card className="flex items-center justify-center h-64 border-dashed no-print">
                    <p className="text-muted-foreground">Por favor, seleccione una zafra para generar el reporte.</p>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Total Producción</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">${reporteData.costoTotal.toLocaleString('es-AR')}</div></CardContent></Card>
                        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Superficie Total</CardTitle><AreaChart/></CardHeader><CardContent><div className="text-2xl font-bold">{reporteData.superficieTotal} ha</div></CardContent></Card>
                        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Promedio / ha</CardTitle><TrendingDown/></CardHeader><CardContent><div className="text-2xl font-bold">${reporteData.costoPorHa.toFixed(2)}</div></CardContent></Card>
                        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Eventos Totales</CardTitle><Package/></CardHeader><CardContent><div className="text-2xl font-bold">{reporteData.eventosCount}</div></CardContent></Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-5">
                        <Card className="md:col-span-3">
                             <CardHeader><CardTitle>Evolución de Costos (Acumulado)</CardTitle></CardHeader>
                             <CardContent><ResponsiveContainer width="100%" height={300}><Line data={reporteData.costoAcumulado} type="monotone" dataKey="costo" strokeWidth={2} stroke="hsl(var(--primary))"/></ResponsiveContainer></CardContent>
                        </Card>
                        <Card className="md:col-span-2">
                            <CardHeader><CardTitle>Distribución de Costos (Insumos)</CardTitle></CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={reporteData.costosPorCategoriaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ label }) => label}>
                                            {reporteData.costosPorCategoriaData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Costos por Parcela</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Parcela</TableHead><TableHead>Superficie (ha)</TableHead><TableHead className="text-right">Costo Total ($)</TableHead><TableHead className="text-right">Costo/ha ($)</TableHead><TableHead className="text-right">% del Total</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {reporteData.costosPorParcela.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.nombre}</TableCell>
                                            <TableCell>{p.superficie}</TableCell>
                                            <TableCell className="text-right font-mono">${p.costoTotal.toLocaleString('es-AR')}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">${p.costoPorHa.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{p.porcentaje.toFixed(1)}%</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Top 10 Insumos por Impacto Económico</CardTitle></CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead className="text-right">Cantidad Usada</TableHead><TableHead className="text-right">Costo Total</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {reporteData.topInsumos.map(ins => (
                                        <TableRow key={ins.nombre}>
                                            <TableCell className="font-medium">{ins.nombre}</TableCell>
                                            <TableCell className="text-right">{ins.cantidad.toFixed(2)} {ins.unidad}</TableCell>
                                            <TableCell className="text-right font-mono">${ins.costo.toLocaleString('es-AR')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                </div>
            )}
        </div>
    )
}

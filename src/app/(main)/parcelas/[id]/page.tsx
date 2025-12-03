"use client";

import { useMemo } from 'react';
import { notFound, useRouter } from "next/navigation";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import type { Parcela, Evento, Cultivo, Zafra, Insumo } from '@/lib/types';

import { PageHeader } from "@/components/shared/page-header";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, Tractor, Droplets, Sprout, Activity, CalendarDays, LineChart, PieChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function ParcelaCostoReportePage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  const router = useRouter();

  // --- Data Fetching ---
  const parcelaRef = useMemoFirebase(() => firestore ? doc(firestore, 'parcelas', params.id) : null, [firestore, params.id]);
  const { data: parcela, isLoading: l1 } = useDoc<Parcela>(parcelaRef);
  
  const eventosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), where('parcelaId', '==', params.id), orderBy('fecha')) : null, [firestore, params.id]);
  const { data: eventos, isLoading: l2 } = useCollection<Evento>(eventosQuery);

  const insumosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'insumos') : null, [firestore]);
  const { data: insumos, isLoading: l3 } = useCollection<Insumo>(insumosQuery);
  
  const zafrasQuery = useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]);
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(zafrasQuery);

  const isLoading = l1 || l2 || l3 || l4;

  // --- Data Processing ---
  const {
    zafra,
    cultivo,
    costoTotal,
    costoPorHa,
    totalInsumos,
    totalServicios,
    ultimoEvento,
    costosPorTipoEvento,
    topInsumos,
    costoAcumulado,
  } = useMemo(() => {
    if (!parcela || !eventos || !insumos || !zafras) return { costosPorTipoEvento: [], topInsumos: [], costoAcumulado: [] };

    // Asumimos una zafra por parcela para simplificar, en un caso real esto sería más complejo
    const zafraActiva = zafras.find(z => eventos.some(e => e.zafraId === z.id));
    const cultivoAsociado = zafraActiva ? zafras.find(z => z.id === zafraActiva.cultivoId) : null;
    
    const costoTotal = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
    const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
    
    const totalServicios = eventos.reduce((sum, ev) => sum + ((ev.hectareasAplicadas || 0) * (ev.costoServicioPorHa || 0)), 0);
    const totalInsumos = costoTotal - totalServicios;
    
    const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;

    const costosPorTipo = eventos.reduce((acc, ev) => {
        const tipo = ev.categoria || ev.tipo;
        acc[tipo] = (acc[tipo] || 0) + (ev.costoTotal || 0);
        return acc;
    }, {} as Record<string, number>);
    const costosPorTipoEvento = Object.entries(costosPorTipo).map(([name, value]) => ({ name, value }));

    const insumosCostos = eventos.flatMap(e => e.productos || []).reduce((acc, prod) => {
        const insumo = insumos.find(i => i.id === prod.insumoId);
        if (!insumo) return acc;
        const costo = prod.cantidad * (insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
        acc[insumo.nombre] = (acc[insumo.nombre] || { costo: 0, cantidad: 0, unidad: insumo.unidad });
        acc[insumo.nombre].costo += costo;
        acc[insumo.nombre].cantidad += prod.cantidad;
        return acc;
    }, {} as Record<string, { costo: number, cantidad: number, unidad: string }>);
    const topInsumos = Object.entries(insumosCostos).map(([nombre, data]) => ({ nombre, ...data })).sort((a, b) => b.costo - a.costo).slice(0, 10);

    let acumulado = 0;
    const costoAcumulado = eventos.map(ev => {
        acumulado += ev.costoTotal || 0;
        return {
            fecha: format(new Date(ev.fecha as string), 'dd/MM'),
            costoAcumulado: acumulado
        };
    });

    return { zafra: zafraActiva, cultivo: cultivoAsociado, costoTotal, costoPorHa, totalInsumos, totalServicios, ultimoEvento, costosPorTipoEvento, topInsumos, costoAcumulado };
  }, [parcela, eventos, insumos, zafras]);

  if (isLoading) return <p>Cargando reporte de costos...</p>;
  if (!parcela) return notFound();

  return (
    <>
      <PageHeader title={`Reporte de Costos: ${parcela.nombre}`} description={`Análisis financiero para la campaña ${zafra?.nombre || 'N/A'}`}>
        <Button onClick={() => router.push('/parcelas')}>Volver a Parcelas</Button>
      </PageHeader>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Total</CardTitle><DollarSign /></CardHeader><CardContent><div className="text-2xl font-bold">${costoTotal?.toLocaleString('es-AR') || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Prom./ha</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">${costoPorHa?.toFixed(2) || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Insumos</CardTitle><Droplets /></CardHeader><CardContent><div className="text-2xl font-bold">${totalInsumos?.toLocaleString('es-AR') || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Costo Servicios</CardTitle><Tractor /></CardHeader><CardContent><div className="text-2xl font-bold">${totalServicios?.toLocaleString('es-AR') || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Último Evento</CardTitle><CalendarDays /></CardHeader><CardContent><div className="text-md font-bold">{ultimoEvento?.descripcion}</div><p className="text-xs text-muted-foreground">${(ultimoEvento?.costoTotal || 0).toLocaleString('es-AR')}</p></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-5 mb-6">
        <Card className="md:col-span-2">
            <CardHeader><CardTitle>Distribución de Costos</CardTitle><CardDescription>Por tipo de evento</CardDescription></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={costosPorTipoEvento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                            {costosPorTipoEvento?.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
        <Card className="md:col-span-3">
            <CardHeader><CardTitle>Costo Acumulado</CardTitle><CardDescription>Evolución del gasto durante la campaña</CardDescription></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={costoAcumulado}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis tickFormatter={(value) => `$${Number(value)/1000}k`} />
                        <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-AR')}`} />
                        <Legend />
                        <Line type="monotone" dataKey="costoAcumulado" stroke="#8884d8" strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      {/* Top Insumos */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Top Insumos por Costo</CardTitle></CardHeader>
        <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead>Cantidad Usada</TableHead><TableHead className="text-right">Costo Total</TableHead></TableRow></TableHeader>
                <TableBody>
                    {topInsumos?.map(ins => (
                        <TableRow key={ins.nombre}>
                            <TableCell className="font-medium">{ins.nombre}</TableCell>
                            <TableCell>{ins.cantidad.toFixed(2)} {ins.unidad}</TableCell>
                            <TableCell className="text-right font-mono">${ins.costo.toLocaleString('es-AR')}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      {/* Eventos Table */}
      <Card>
        <CardHeader><CardTitle>Eventos Económicos de la Parcela</CardTitle></CardHeader>
        <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Costo Insumos</TableHead><TableHead className="text-right">Costo Servicio</TableHead><TableHead className="text-right">Costo Total</TableHead><TableHead className="text-right">Costo/ha</TableHead></TableRow></TableHeader>
                <TableBody>
                    {eventos?.filter(e => e.costoTotal && e.costoTotal > 0).map(ev => {
                        const costoServ = (ev.hectareasAplicadas || 0) * (ev.costoServicioPorHa || 0);
                        const costoIns = (ev.costoTotal || 0) - costoServ;
                        return (
                            <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50">
                                <TableCell>{format(new Date(ev.fecha as string), 'dd/MM/yyyy')}</TableCell>
                                <TableCell><Badge variant="outline">{ev.categoria || ev.tipo}</Badge></TableCell>
                                <TableCell className="font-medium">{ev.descripcion}</TableCell>
                                <TableCell className="text-right font-mono">${costoIns.toLocaleString('es-AR')}</TableCell>
                                <TableCell className="text-right font-mono">${costoServ.toLocaleString('es-AR')}</TableCell>
                                <TableCell className="text-right font-bold font-mono">${(ev.costoTotal || 0).toLocaleString('es-AR')}</TableCell>
                                <TableCell className="text-right font-semibold font-mono">${(ev.costoPorHa || 0).toFixed(2)}</TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </>
  );
}

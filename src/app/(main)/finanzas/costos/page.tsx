"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Tractor, Sprout, TrendingDown, Package, FileText } from "lucide-react";
import type { Evento, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function CostosPage() {
  const firestore = useFirestore();

  const { data: eventos, isLoading: l1 } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]));
  const { data: zafras, isLoading: l3 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]));
  const { data: cultivos, isLoading: l4 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]));

  const isLoading = l1 || l2 || l3 || l4;

  const { totalCostos, costosPorCategoria, costosPorZafra } = useMemo(() => {
    if (!eventos || !zafras) return { totalCostos: 0, costosPorCategoria: [], costosPorZafra: [] };
    
    const totalCostos = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);

    const costosCat = eventos.reduce((acc, ev) => {
      const categoria = ev.categoria || 'Otros';
      acc[categoria] = (acc[categoria] || 0) + (ev.costoTotal || 0);
      return acc;
    }, {} as Record<string, number>);
    const costosPorCategoria = Object.entries(costosCat).map(([name, value]) => ({ name, value }));

    const costosZafra = zafras.map(zafra => {
        const costo = eventos.filter(ev => ev.zafraId === zafra.id).reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        return { name: zafra.nombre, costo };
    }).filter(z => z.costo > 0);

    return { totalCostos, costosPorCategoria, costosPorZafra };
  }, [eventos, zafras]);

  const getNombre = (id: string, coleccion: any[] | null) => coleccion?.find(item => item.id === id)?.nombre || 'N/A';

  return (
    <>
      <PageHeader
        title="Gestión de Costos por Evento"
        description="Análisis automático de costos operativos derivados de las actividades de campo."
      />
      
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total Acumulado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostos.toLocaleString('en-US')}</div>
            <p className="text-xs text-muted-foreground">Suma de todos los costos de eventos</p>
          </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eventos Registrados</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{eventos?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Total de actividades con costos</p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Zafras con Costos</CardTitle>
                <Sprout className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{costosPorZafra.length}</div>
                <p className="text-xs text-muted-foreground">Campañas que han incurrido en costos</p>
            </CardContent>
        </Card>
      </div>

       <Card className="mb-6">
          <CardHeader>
            <CardTitle>Costos por Zafra</CardTitle>
            <CardDescription>Visualización de los costos totales por cada campaña agrícola.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costosPorZafra}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${Number(value)/1000}k`} />
                <Tooltip 
                    formatter={(value) => `$${(typeof value === 'number' ? value.toLocaleString('en-US') : value)}`} 
                    cursor={{ fill: 'hsla(var(--muted))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))' }}
                />
                <Bar dataKey="costo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado Detallado de Costos por Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento (Descripción)</TableHead>
                <TableHead>Tipo/Categoría</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Zafra</TableHead>
                <TableHead className="text-right">Costo Total ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando costos...</TableCell></TableRow>}
              {eventos?.map((evento) => (
                <TableRow key={evento.id}>
                  <TableCell>{format(new Date(evento.fecha as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{evento.descripcion}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{evento.categoria || evento.tipo}</Badge></TableCell>
                  <TableCell>{getNombre(evento.parcelaId, parcelas)}</TableCell>
                  <TableCell>{getNombre(evento.zafraId, zafras)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${(evento.costoTotal || 0).toLocaleString('en-US')}</TableCell>
                </TableRow>
              ))}
              {!isLoading && eventos?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No hay eventos con costos registrados.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Tractor, Sprout, TrendingDown, Package, FileText, Users } from "lucide-react";
import type { Evento, Parcela, Zafra, Cultivo, ControlHorario } from "@/lib/types";
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
  const { data: horas, isLoading: l4 } = useCollection<ControlHorario>(useMemoFirebase(() => firestore ? query(collection(firestore, 'controlHorario')) : null, [firestore]));

  const isLoading = l1 || l2 || l3 || l4;

  const { totalCostosEventos, totalCostosManoObra, costosPorZafra, costosCombinados } = useMemo(() => {
    if (!eventos || !zafras || !horas) return { totalCostosEventos: 0, totalCostosManoObra: 0, costosPorZafra: [], costosCombinados: [] };
    
    const costosEventos = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
    const costosManoObra = horas.reduce((sum, h) => sum + (h.costoManoDeObra || 0), 0);
    
    const costosZafraData = zafras.map(zafra => {
        const costoEventos = eventos.filter(ev => ev.zafraId === zafra.id).reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        return { name: zafra.nombre, costo: costoEventos };
    }).filter(z => z.costo > 0);

    const todosLosCostos = [
        ...eventos.map(e => ({ fecha: e.fecha, descripcion: e.descripcion, tipo: 'Evento', monto: e.costoTotal || 0, parcelaId: e.parcelaId, zafraId: e.zafraId, categoria: e.categoria || e.tipo })),
        ...horas.map(h => ({ fecha: h.fecha, descripcion: `Mano de obra: ${h.tipoTrabajo || 'General'}`, tipo: 'Mano de Obra', monto: h.costoManoDeObra || 0, parcelaId: h.parcelaId || '', zafraId: '', categoria: 'Mano de Obra' }))
    ].sort((a,b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime());

    return { 
        totalCostosEventos: costosEventos, 
        totalCostosManoObra: costosManoObra, 
        costosPorZafra: costosZafraData,
        costosCombinados: todosLosCostos,
    };
  }, [eventos, zafras, horas]);

  const totalGeneral = totalCostosEventos + totalCostosManoObra;
  const getNombre = (id: string, coleccion: any[] | null) => coleccion?.find(item => item.id === id)?.nombre || 'N/A';

  return (
    <>
      <PageHeader
        title="Gestión de Costos Operativos"
        description="Análisis consolidado de costos de eventos de campo y mano de obra."
      />
      
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costo Total (Eventos + MO)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalGeneral.toLocaleString('en-US')}</div><p className="text-xs text-muted-foreground">Suma de todos los costos</p></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costo por Eventos</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalCostosEventos.toLocaleString('en-US')}</div><p className="text-xs text-muted-foreground">Total de actividades con costos</p></CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costo Mano de Obra</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">${totalCostosManoObra.toLocaleString('en-US')}</div><p className="text-xs text-muted-foreground">Total de horas aprobadas</p></CardContent>
        </Card>
      </div>

       <Card className="mb-6">
          <CardHeader>
            <CardTitle>Costos por Zafra (Eventos)</CardTitle>
            <CardDescription>Visualización de los costos de eventos totales por cada campaña agrícola.</CardDescription>
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
          <CardTitle>Listado Detallado de Costos (Eventos y Mano de Obra)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo/Categoría</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Zafra</TableHead>
                <TableHead className="text-right">Costo Total ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando costos...</TableCell></TableRow>}
              {costosCombinados?.map((costo, index) => (
                <TableRow key={index}>
                  <TableCell>{format(new Date(costo.fecha as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{costo.descripcion}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{costo.categoria}</Badge></TableCell>
                  <TableCell>{getNombre(costo.parcelaId, parcelas)}</TableCell>
                  <TableCell>{getNombre(costo.zafraId, zafras)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${(costo.monto || 0).toLocaleString('en-US')}</TableCell>
                </TableRow>
              ))}
              {!isLoading && costosCombinados?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No hay costos registrados.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

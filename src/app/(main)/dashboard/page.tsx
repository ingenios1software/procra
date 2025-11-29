"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/store/data-store";
import { Activity, Map, Calendar, TriangleAlert, AreaChart } from "lucide-react";
import { format, subDays } from "date-fns";
import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPage() {
  const { parcelas, cultivos, zafras, eventos } = useDataStore();
  
  const totalParcelas = parcelas.length;
  const totalHectareas = useMemo(() => parcelas.reduce((acc, p) => acc + p.superficie, 0), [parcelas]);
  const zafraActiva = zafras.find(z => z.estado === 'en curso');

  const eventosPorTipo = useMemo(() => {
    return eventos.reduce((acc, evento) => {
      acc[evento.tipo] = (acc[evento.tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [eventos]);

  const zafraProgress = useMemo(() => {
    if (!zafraActiva || !zafraActiva.fechaFin || !zafraActiva.fechaInicio) return 0;
    const totalDuration = new Date(zafraActiva.fechaFin).getTime() - new Date(zafraActiva.fechaInicio).getTime();
    if (totalDuration <= 0) return 0;
    const elapsed = new Date().getTime() - new Date(zafraActiva.fechaInicio).getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    return Math.round(progress);
  }, [zafraActiva]);

  const eventosPorMes = useMemo(() => {
    const data = eventos.reduce((acc, evento) => {
      const month = format(new Date(evento.fecha), "MMM yyyy");
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(data).map(([name, total]) => ({ name, total })).slice(-6); // Last 6 months
  }, [eventos]);

  const distribucionCultivos = useMemo(() => {
    const data = eventos.reduce((acc, evento) => {
      const cultivo = cultivos.find(c => c.id === evento.cultivoId);
      if (cultivo) {
        acc[cultivo.nombre] = (acc[cultivo.nombre] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [eventos, cultivos]);

  const alertasParcelas = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    return parcelas.filter(parcela => {
      const lastEvent = eventos
        .filter(e => e.parcelaId === parcela.id)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
      return !lastEvent || new Date(lastEvent.fecha) < thirtyDaysAgo;
    });
  }, [parcelas, eventos]);

  return (
    <>
      <PageHeader
        title="Bienvenido a CRApro95"
        description="Sistema Integral de Gestión Agrícola. Administra tus parcelas, cultivos, eventos y zafras desde un solo lugar."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcelas}</div>
            <p className="text-xs text-muted-foreground">Parcelas gestionadas en el sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superficie Total</CardTitle>
            <AreaChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHectareas} ha</div>
            <p className="text-xs text-muted-foreground">Suma de todas las parcelas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Registrados</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventos.length}</div>
            <p className="text-xs text-muted-foreground">Eventos agrícolas registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avance de Zafra Activa</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zafraProgress}%</div>
            <p className="text-xs text-muted-foreground">{zafraActiva?.nombre || 'Sin zafra activa'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Eventos por Mes (Últimos 6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventosPorMes}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip cursor={{ fill: 'hsla(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribución de Cultivos</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={distribucionCultivos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {distribucionCultivos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                 <Tooltip cursor={{ fill: 'hsla(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 mt-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Eventos por Tipo</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(eventosPorTipo).map(([tipo, count]) => (
              <div key={tipo} className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium capitalize text-muted-foreground">{tipo}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <TriangleAlert className="text-destructive"/>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            {alertasParcelas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertasParcelas.map((parcela) => (
                    <TableRow key={parcela.id} className="text-destructive">
                      <TableCell>{parcela.nombre}</TableCell>
                      <TableCell>Sin eventos en los últimos 30 días</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No hay alertas que mostrar. ¡Buen trabajo!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

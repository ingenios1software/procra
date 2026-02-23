"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Map, Calendar, TriangleAlert, AreaChart, Sparkles } from "lucide-react";
import { format, subDays } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where } from 'firebase/firestore';
import type { Parcela, Cultivo, Zafra, Evento } from "@/lib/types";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function DashboardWatermarkFooter() {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center" aria-hidden="true">
      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/50 px-3 py-1 text-[11px] text-muted-foreground opacity-45 shadow-sm backdrop-blur-sm">
        <Sparkles className="h-3 w-3" />
        <span className="tracking-wide">Ingeniosoft95</span>
      </div>
    </footer>
  );
}

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  // Filtrar por zafra activa
  const zafraActivaQuery = useMemoFirebase(() => user && firestore ? query(collection(firestore, 'zafras'), where('estado', '==', 'en curso')) : null, [user, firestore]);
  const { data: zafrasActivas, isLoading: l3 } = useCollection<Zafra>(zafraActivaQuery);
  const zafraActiva = zafrasActivas?.[0];

  const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(useMemoFirebase(() => user && firestore ? collection(firestore, 'parcelas') : null, [user, firestore]));
  const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(useMemoFirebase(() => user && firestore ? collection(firestore, 'cultivos') : null, [user, firestore]));
  const { data: eventos, isLoading: l4 } = useCollection<Evento>(
    useMemoFirebase(() => 
      user && firestore && zafraActiva ? query(collection(firestore, 'eventos'), where('zafraId', '==', zafraActiva.id)) : null,
      [user, firestore, zafraActiva]
  ));

  const {
    totalParcelas,
    totalHectareas,
    zafraProgress,
    eventosPorTipo,
    eventosPorMes,
    distribucionCultivos,
    alertasParcelas,
    totalEventos
  } = useMemo(() => {
    if (!parcelas || !cultivos || !zafraActiva || !eventos) {
      return { totalParcelas: 0, totalHectareas: 0, zafraProgress: 0, eventosPorTipo: {}, eventosPorMes: [], distribucionCultivos: [], alertasParcelas: [], totalEventos: 0 };
    }
    
    const idParcelasEnZafra = new Set(eventos.map(e => e.parcelaId));
    const parcelasEnZafra = parcelas.filter(p => idParcelasEnZafra.has(p.id));

    const totalParcelas = parcelasEnZafra.length;
    const totalHectareas = parcelasEnZafra.reduce((acc, p) => acc + p.superficie, 0);
    const totalEventos = eventos.length;

    const eventosPorTipo = eventos.reduce((acc, evento) => {
      const tipo = evento.tipo || 'Sin tipo';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const zafraProgress = (() => {
        const totalDuration = new Date(zafraActiva.fechaFin as string).getTime() - new Date(zafraActiva.fechaInicio as string).getTime();
        if (totalDuration <= 0) return 0;
        const elapsed = new Date().getTime() - new Date(zafraActiva.fechaInicio as string).getTime();
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        return Math.round(progress);
    })();

    const eventosPorMes = (() => {
        const data = eventos.reduce((acc, evento) => {
            const month = format(new Date(evento.fecha as string), "MMM yyyy");
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, total]) => ({ name, total })).slice(-6);
    })();

    const distribucionCultivos = (() => {
        const data = eventos.reduce((acc, evento) => {
            const cultivo = cultivos.find(c => c.id === evento.cultivoId);
            if (cultivo) {
                acc[cultivo.nombre] = (acc[cultivo.nombre] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    })();
    
    const treintaDiasAtras = subDays(new Date(), 30);
    const parcelasConEventosRecientes = new Set(
        eventos.filter(e => new Date(e.fecha as string) > treintaDiasAtras).map(e => e.parcelaId)
    );
    const alertasParcelas = parcelasEnZafra.filter(p => !parcelasConEventosRecientes.has(p.id));

    return { totalParcelas, totalHectareas, zafraActiva, zafraProgress, eventosPorTipo, eventosPorMes, distribucionCultivos, alertasParcelas, totalEventos };
  }, [parcelas, cultivos, zafraActiva, eventos]);

  const isLoading = isUserLoading || l1 || l2 || l3 || l4;
  if (isLoading) return <p>Cargando dashboard de monitoreo...</p>;

  if (!user) {
    return (
      <>
        <PageHeader
          title="Dashboard de Monitoreo"
          description="Vista general de la zafra activa."
        />
        <Card className="flex items-center justify-center h-48 border-dashed">
          <p className="text-muted-foreground">Iniciando sesión para cargar datos del dashboard...</p>
        </Card>
        <DashboardWatermarkFooter />
      </>
    );
  }
  
  if (!zafraActiva) {
    return (
        <>
            <PageHeader
                title="Dashboard de Monitoreo"
                description="Vista general de la zafra activa."
            />
            <Card className="flex items-center justify-center h-48 border-dashed">
                <p className="text-muted-foreground">No hay una zafra &quot;en curso&quot; activa para mostrar el dashboard.</p>
            </Card>
            <DashboardWatermarkFooter />
        </>
    )
  }


  return (
    <>
      <PageHeader
        title="Dashboard de Monitoreo"
        description={`Resumen de la zafra activa: ${zafraActiva?.nombre || 'N/A'}`}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcelas}</div>
            <p className="text-xs text-muted-foreground">Parcelas en esta zafra</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superficie Total</CardTitle>
            <AreaChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHectareas.toLocaleString('de-DE')} ha</div>
            <p className="text-xs text-muted-foreground">Suma de parcelas en la zafra</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Registrados</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEventos}</div>
            <p className="text-xs text-muted-foreground">Actividades en la zafra</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avance de Zafra</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zafraProgress}%</div>
            <p className="text-xs text-muted-foreground">Progreso estimado de la campaña</p>
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

      <DashboardWatermarkFooter />
    </>
  );
}

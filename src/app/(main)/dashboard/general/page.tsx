"use client";

import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { Activity, AreaChart, Calendar, Map as MapIcon, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCollection, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cultivo, Evento, Parcela, Zafra } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const MAX_PIE_SEGMENTS = 5;

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function DashboardGeneralPage() {
  const tenant = useTenantFirestore();

  const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(
    useMemoFirebase(() => tenant.collection("parcelas"), [tenant])
  );
  const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(
    useMemoFirebase(() => tenant.collection("cultivos"), [tenant])
  );
  const { data: zafras, isLoading: l3 } = useCollection<Zafra>(
    useMemoFirebase(() => tenant.collection("zafras"), [tenant])
  );
  const { data: eventos, isLoading: l4 } = useCollection<Evento>(
    useMemoFirebase(() => tenant.collection("eventos"), [tenant])
  );

  const {
    totalParcelas,
    totalHectareas,
    zafraActiva,
    zafraProgress,
    eventosPorMes,
    eventosPorTipoData,
    distribucionCultivos,
    alertasParcelas,
    totalEventos,
    eventosUltimos30Dias,
  } = useMemo(() => {
    if (!parcelas || !cultivos || !zafras || !eventos) {
      return {
        totalParcelas: 0,
        totalHectareas: 0,
        zafraActiva: null,
        zafraProgress: 0,
        eventosPorMes: [],
        eventosPorTipoData: [],
        distribucionCultivos: [],
        alertasParcelas: [],
        totalEventos: 0,
        eventosUltimos30Dias: 0,
      };
    }

    const totalParcelas = parcelas.length;
    const totalHectareas = parcelas.reduce((acc, parcela) => acc + (parcela.superficie || 0), 0);
    const zafraActiva = zafras.find((zafra) => zafra.estado === "en curso") || null;
    const totalEventos = eventos.length;
    const treintaDiasAtras = subDays(new Date(), 30);

    const eventosUltimos30Dias = eventos.filter((evento) => {
      const fecha = toDate(evento.fecha);
      return !!fecha && fecha > treintaDiasAtras;
    }).length;

    const eventosPorTipoMap = eventos.reduce((acc, evento) => {
      const tipo = evento.tipo || "Sin tipo";
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const eventosPorTipoData = Object.entries(eventosPorTipoMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const zafraProgress = (() => {
      if (!zafraActiva) return 0;
      const inicio = toDate(zafraActiva.fechaInicio);
      const fin = toDate(zafraActiva.fechaFin);
      if (!inicio || !fin) return 0;
      const totalDuration = fin.getTime() - inicio.getTime();
      if (totalDuration <= 0) return 0;
      const elapsed = new Date().getTime() - inicio.getTime();
      return Math.round(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)));
    })();

    const eventosMesMap = eventos.reduce((acc, evento) => {
      const fecha = toDate(evento.fecha);
      if (!fecha) return acc;
      const monthKey = format(fecha, "yyyy-MM");
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const eventosPorMes = Object.entries(eventosMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([monthKey, total]) => ({
        name: format(new Date(`${monthKey}-01T00:00:00`), "MMM yyyy"),
        total,
      }));

    const cultivosPorId = new Map(cultivos.map((cultivo) => [cultivo.id, cultivo.nombre]));
    const distribucionCultivosMap = eventos.reduce((acc, evento) => {
      const cultivoNombre = cultivosPorId.get(evento.cultivoId);
      if (!cultivoNombre) return acc;
      acc[cultivoNombre] = (acc[cultivoNombre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedCultivos = Object.entries(distribucionCultivosMap).sort(([, a], [, b]) => b - a);
    const distribucionCultivos = sortedCultivos
      .slice(0, MAX_PIE_SEGMENTS)
      .map(([name, value]) => ({ name, value }));
    const restanteCultivos = sortedCultivos
      .slice(MAX_PIE_SEGMENTS)
      .reduce((acc, [, value]) => acc + value, 0);
    if (restanteCultivos > 0) {
      distribucionCultivos.push({ name: "Otros", value: restanteCultivos });
    }

    const parcelasConEventosRecientes = new Set(
      eventos
        .filter((evento) => {
          const fecha = toDate(evento.fecha);
          return !!fecha && fecha > treintaDiasAtras;
        })
        .map((evento) => evento.parcelaId)
    );
    const alertasParcelas = parcelas.filter((parcela) => !parcelasConEventosRecientes.has(parcela.id));

    return {
      totalParcelas,
      totalHectareas,
      zafraActiva,
      zafraProgress,
      eventosPorMes,
      eventosPorTipoData,
      distribucionCultivos,
      alertasParcelas,
      totalEventos,
      eventosUltimos30Dias,
    };
  }, [parcelas, cultivos, zafras, eventos]);

  const isLoading = l1 || l2 || l3 || l4;
  if (isLoading) return <p>Cargando dashboard...</p>;

  const shareSummary = `Parcelas: ${totalParcelas} | Superficie: ${totalHectareas} ha | Eventos: ${totalEventos} (${eventosUltimos30Dias} en 30 dias).`;

  return (
    <>
      <PageHeader
        title="Bienvenido a CRApro95"
        description="Sistema integral de gestion agricola para parcelas, cultivos, eventos y zafras."
      >
        <ReportActions reportTitle="Dashboard General" reportSummary={shareSummary} />
      </PageHeader>
      <div id="pdf-area" className="print-area">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
            <MapIcon className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-2xl font-bold">{totalEventos}</div>
            <p className="text-xs text-muted-foreground">{eventosUltimos30Dias} en los ultimos 30 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avance de Zafra Activa</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zafraProgress}%</div>
            <p className="text-xs text-muted-foreground">{zafraActiva?.nombre || "Sin zafra activa"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Eventos por Mes (ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {eventosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay eventos suficientes para construir la serie mensual.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribucion de Cultivos</CardTitle>
          </CardHeader>
          <CardContent>
            {distribucionCultivos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribucionCultivos}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {distribucionCultivos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay distribucion de cultivos para mostrar.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {eventosPorTipoData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={eventosPorTipoData.slice(0, 8)} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {eventosPorTipoData.slice(0, 6).map((item) => (
                    <div key={item.name} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium capitalize text-muted-foreground">{item.name}</p>
                      <p className="text-xl font-bold">{item.total}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos por tipo para mostrar.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <TriangleAlert className="text-destructive" />
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            {alertasParcelas.length > 0 ? (
              <Table className="min-w-[420px]">
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
                      <TableCell>Sin eventos en los ultimos 30 dias</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No hay alertas para mostrar.</p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}

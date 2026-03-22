"use client";

import { useMemo } from "react";
import { where } from "firebase/firestore";
import { format, subDays } from "date-fns";
import { Activity, AreaChart, Calendar, Map as MapIcon, Sparkles, TriangleAlert } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
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

type MonthDatum = { name: string; total: number };
type PieDatum = { name: string; value: number };

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeText(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
  const tenant = useTenantFirestore();
  const { user, isUserLoading } = useUser();

  const zafraActivaQuery = useMemoFirebase(
    () => (user ? tenant.query("zafras", where("estado", "==", "en curso")) : null),
    [tenant, user]
  );
  const { data: zafrasActivas, isLoading: l3 } = useCollection<Zafra>(zafraActivaQuery);

  const zafraActiva = useMemo(() => {
    if (!zafrasActivas || zafrasActivas.length === 0) return null;
    return [...zafrasActivas].sort((a, b) => {
      const aTime = toDate(a.fechaInicio)?.getTime() ?? 0;
      const bTime = toDate(b.fechaInicio)?.getTime() ?? 0;
      return bTime - aTime;
    })[0];
  }, [zafrasActivas]);

  const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(
    useMemoFirebase(() => (user ? tenant.collection("parcelas") : null), [tenant, user])
  );
  const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(
    useMemoFirebase(() => (user ? tenant.collection("cultivos") : null), [tenant, user])
  );
  const { data: eventos, isLoading: l4 } = useCollection<Evento>(
    useMemoFirebase(() => (user ? tenant.collection("eventos") : null), [tenant, user])
  );

  const {
    totalParcelas,
    totalHectareas,
    zafraProgress,
    eventosPorTipo,
    eventosPorMes,
    distribucionCultivos,
    alertasParcelas,
    totalEventos,
    dataScopeLabel,
  } = useMemo(() => {
    if (!parcelas || !cultivos || !zafraActiva || !eventos) {
      return {
        totalParcelas: 0,
        totalHectareas: 0,
        zafraProgress: null as number | null,
        eventosPorTipo: {} as Record<string, number>,
        eventosPorMes: [] as MonthDatum[],
        distribucionCultivos: [] as PieDatum[],
        alertasParcelas: [] as Parcela[],
        totalEventos: 0,
        dataScopeLabel: "",
      };
    }

    const cultivoPorId = new Map(cultivos.map((cultivo) => [cultivo.id, cultivo.nombre]));
    const inicioZafra = toDate(zafraActiva.fechaInicio);
    const finZafra = toDate(zafraActiva.fechaFin);

    const eventosPorZafraId = eventos.filter((evento) => evento.zafraId === zafraActiva.id);
    const eventosPorRangoFechas =
      inicioZafra
        ? eventos.filter((evento) => {
            const fechaEvento = toDate(evento.fecha);
            if (!fechaEvento) return false;
            if (finZafra) return fechaEvento >= inicioZafra && fechaEvento <= finZafra;
            return fechaEvento >= inicioZafra;
          })
        : [];

    const eventosZafra =
      eventosPorZafraId.length > 0
        ? eventosPorZafraId
        : eventosPorRangoFechas.length > 0
          ? eventosPorRangoFechas
          : [];

    const dataScopeLabel =
      eventosPorZafraId.length > 0
        ? "Datos vinculados por zafra."
        : eventosPorRangoFechas.length > 0
          ? "No hubo coincidencia por zafraId. Se muestran eventos por rango de fechas de la zafra."
          : "No hay eventos asociados a la zafra activa.";

    const idParcelasEnZafra = new Set(eventosZafra.map((evento) => evento.parcelaId));
    let parcelasEnZafra = parcelas.filter((parcela) => idParcelasEnZafra.has(parcela.id));

    if (parcelasEnZafra.length === 0 && zafraActiva.cultivoId) {
      const cultivoActivoNombre = cultivoPorId.get(zafraActiva.cultivoId);
      if (cultivoActivoNombre) {
        const cultivoNormalizado = normalizeText(cultivoActivoNombre);
        parcelasEnZafra = parcelas.filter(
          (parcela) => normalizeText(parcela.cultivoActual) === cultivoNormalizado
        );
      }
    }

    if (parcelasEnZafra.length === 0 && eventosZafra.length === 0) {
      parcelasEnZafra = parcelas.filter((parcela) => parcela.estado !== "inactiva");
    }

    const totalParcelas = parcelasEnZafra.length;
    const totalHectareas = parcelasEnZafra.reduce((acc, parcela) => acc + (parcela.superficie || 0), 0);
    const totalEventos = eventosZafra.length;

    const eventosPorTipo = eventosZafra.reduce((acc, evento) => {
      const tipo = evento.tipo || "Sin tipo";
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventosPorMesMap = eventosZafra.reduce((acc, evento) => {
      const fechaEvento = toDate(evento.fecha);
      if (!fechaEvento) return acc;
      const monthKey = format(fechaEvento, "yyyy-MM");
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventosPorMes = Object.entries(eventosPorMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([monthKey, total]) => ({
        name: format(new Date(`${monthKey}-01T00:00:00`), "MMM yyyy"),
        total,
      }));

    const distribucionCultivosMap = eventosZafra.reduce((acc, evento) => {
      const cultivoId = evento.cultivoId || zafraActiva.cultivoId;
      const cultivoNombre = cultivoId ? cultivoPorId.get(cultivoId) : undefined;
      if (!cultivoNombre) return acc;
      acc[cultivoNombre] = (acc[cultivoNombre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(distribucionCultivosMap).length === 0 && zafraActiva.cultivoId && totalParcelas > 0) {
      const cultivoNombre = cultivoPorId.get(zafraActiva.cultivoId);
      if (cultivoNombre) distribucionCultivosMap[cultivoNombre] = totalParcelas;
    }

    const distribucionCultivos = Object.entries(distribucionCultivosMap).map(([name, value]) => ({
      name,
      value,
    }));

    const treintaDiasAtras = subDays(new Date(), 30);
    const parcelasConEventosRecientes = new Set(
      eventosZafra
        .filter((evento) => {
          const fechaEvento = toDate(evento.fecha);
          return !!fechaEvento && fechaEvento > treintaDiasAtras;
        })
        .map((evento) => evento.parcelaId)
    );

    const parcelasBaseAlerta =
      parcelasEnZafra.length > 0 ? parcelasEnZafra : parcelas.filter((parcela) => parcela.estado !== "inactiva");
    const alertasParcelas = parcelasBaseAlerta.filter(
      (parcela) => !parcelasConEventosRecientes.has(parcela.id)
    );

    const zafraProgress = (() => {
      if (!inicioZafra) return null;

      if (finZafra && finZafra.getTime() > inicioZafra.getTime()) {
        const totalDuration = finZafra.getTime() - inicioZafra.getTime();
        const elapsed = new Date().getTime() - inicioZafra.getTime();
        return Math.round(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)));
      }

      const totalDurationFallback = 120 * 24 * 60 * 60 * 1000;
      const elapsed = new Date().getTime() - inicioZafra.getTime();
      return Math.round(Math.min(100, Math.max(0, (elapsed / totalDurationFallback) * 100)));
    })();

    return {
      totalParcelas,
      totalHectareas,
      zafraProgress,
      eventosPorTipo,
      eventosPorMes,
      distribucionCultivos,
      alertasParcelas,
      totalEventos,
      dataScopeLabel,
    };
  }, [parcelas, cultivos, zafraActiva, eventos]);
  const shareSummary = zafraActiva
    ? `Zafra: ${zafraActiva.nombre || "N/A"} | Parcelas: ${totalParcelas} | Eventos: ${totalEventos} | Superficie: ${totalHectareas.toLocaleString("de-DE")} ha.`
    : "Dashboard de monitoreo sin zafra activa.";

  const isLoading = isUserLoading || l1 || l2 || l3 || l4;
  if (isLoading) return <p>Cargando dashboard de monitoreo...</p>;

  if (!user) {
    return (
      <>
        <PageHeader title="Inicio" description="Vista principal del sistema y de la zafra activa.">
          <ReportActions reportTitle="Inicio" reportSummary={shareSummary} />
        </PageHeader>
        <Card className="flex items-center justify-center h-48 border-dashed">
          <p className="text-muted-foreground">Iniciando sesion para cargar datos del dashboard...</p>
        </Card>
        <DashboardWatermarkFooter />
      </>
    );
  }

  if (!zafraActiva) {
    return (
      <>
        <PageHeader title="Inicio" description="Vista principal del sistema y de la zafra activa.">
          <ReportActions reportTitle="Inicio" reportSummary={shareSummary} />
        </PageHeader>
        <Card className="flex items-center justify-center h-48 border-dashed">
          <p className="text-muted-foreground">
            No hay una zafra &quot;en curso&quot; activa para mostrar el dashboard.
          </p>
        </Card>
        <DashboardWatermarkFooter />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Inicio"
        description={`Resumen operativo de la zafra activa: ${zafraActiva.nombre || "N/A"}`}
      >
        <ReportActions reportTitle="Inicio" reportSummary={shareSummary} />
      </PageHeader>

      {dataScopeLabel ? <p className="mb-4 text-sm text-muted-foreground">{dataScopeLabel}</p> : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
            <MapIcon className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-2xl font-bold">{totalHectareas.toLocaleString("de-DE")} ha</div>
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
            <div className="text-2xl font-bold">{zafraProgress === null ? "N/D" : `${zafraProgress}%`}</div>
            <p className="text-xs text-muted-foreground">
              {zafraProgress === null
                ? "Fechas incompletas para estimar el avance."
                : "Progreso estimado de la campana"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Eventos por Mes (Ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {eventosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventosPorMes}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos suficientes para la serie mensual.</p>
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
                  <Pie data={distribucionCultivos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {distribucionCultivos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
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
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.keys(eventosPorTipo).length > 0 ? (
              Object.entries(eventosPorTipo).map(([tipo, count]) => (
                <div key={tipo} className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium capitalize text-muted-foreground">{tipo}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground col-span-full">No hay eventos por tipo para mostrar.</p>
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
                      <TableCell>Sin eventos en los ultimos 30 dias</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No hay alertas que mostrar. Buen trabajo.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <DashboardWatermarkFooter />
    </>
  );
}

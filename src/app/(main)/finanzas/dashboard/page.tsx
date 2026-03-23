"use client";

import { useMemo } from "react";
import { addMonths, format } from "date-fns";
import {
  Percent,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Landmark,
  Star,
  ChevronsDown,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExecutiveAlerts } from "@/components/finanzas/executive-alerts";
import { ImpuestosSummary } from "@/components/finanzas/impuestos-summary";
import type { Cultivo, Evento, Parcela, Venta } from "@/lib/types";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { getEventTypeDisplay } from "@/lib/eventos/tipos";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const MAX_PIE_CATEGORIES = 5;

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function getIngresoVenta(venta: Venta): number {
  const total = Number(venta.total) || 0;
  if (total > 0) return total;
  return (Number(venta.toneladas) || 0) * (Number(venta.precioTonelada) || 0);
}

function normalizarCategoriaEvento(evento: Evento): string {
  if (evento.categoria && evento.categoria.trim()) return evento.categoria.trim();
  return getEventTypeDisplay(evento);
}

export default function DashboardFinancieroPage() {
  const tenant = useTenantFirestore();

  const { data: eventos, isLoading: l1 } = useCollection<Evento>(
    useMemoFirebase(() => tenant.collection("eventos"), [tenant])
  );
  const { data: ventas, isLoading: l2 } = useCollection<Venta>(
    useMemoFirebase(() => tenant.collection("ventas"), [tenant])
  );
  const { data: parcelas, isLoading: l3 } = useCollection<Parcela>(
    useMemoFirebase(() => tenant.collection("parcelas"), [tenant])
  );
  const { data: cultivos, isLoading: l4 } = useCollection<Cultivo>(
    useMemoFirebase(() => tenant.collection("cultivos"), [tenant])
  );

  const {
    totalCostos,
    totalIngresos,
    margenNeto,
    margenPorcentual,
    rentabilidadPorParcela,
    rentabilidadPorCultivo,
    costosPorCategoria,
    comparativoMensual,
  } = useMemo(() => {
    if (!eventos || !ventas || !parcelas || !cultivos) {
      return {
        totalCostos: 0,
        totalIngresos: 0,
        margenNeto: 0,
        margenPorcentual: 0,
        rentabilidadPorParcela: [],
        rentabilidadPorCultivo: [],
        costosPorCategoria: [],
        comparativoMensual: [],
      };
    }

    const totalCostos = eventos.reduce((acc, evento) => acc + (evento.costoTotal || 0), 0);
    const totalIngresos = ventas.reduce((acc, venta) => acc + getIngresoVenta(venta), 0);
    const margenNeto = totalIngresos - totalCostos;
    const margenPorcentual = totalIngresos > 0 ? (margenNeto / totalIngresos) * 100 : 0;

    const rentabilidadPorParcela = parcelas
      .map((parcela) => {
        const costosParcela = eventos
          .filter((evento) => evento.parcelaId === parcela.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        // Las ventas ya no se imputan por parcela; se muestra margen neto de costos de campo.
        const ingresosParcela = 0;
        return {
          nombre: parcela.nombre,
          rentabilidad: ingresosParcela - costosParcela,
        };
      })
      .sort((a, b) => b.rentabilidad - a.rentabilidad);

    const rentabilidadPorCultivo = cultivos
      .map((cultivo) => {
        const costosCultivo = eventos
          .filter((evento) => evento.cultivoId === cultivo.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        const ingresosCultivo = ventas
          .filter((venta) => venta.cultivoId === cultivo.id)
          .reduce((sum, venta) => sum + getIngresoVenta(venta), 0);
        return {
          name: cultivo.nombre,
          rentabilidad: ingresosCultivo - costosCultivo,
        };
      })
      .sort((a, b) => b.rentabilidad - a.rentabilidad)
      .filter((item) => item.rentabilidad !== 0);

    const costosPorCategoriaMap = eventos.reduce((acc, evento) => {
      const categoria = normalizarCategoriaEvento(evento);
      acc[categoria] = (acc[categoria] || 0) + (evento.costoTotal || 0);
      return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(costosPorCategoriaMap).sort(([, a], [, b]) => b - a);
    const costosPorCategoria = sortedCategories
      .slice(0, MAX_PIE_CATEGORIES)
      .map(([name, value]) => ({ name, value }));
    const restante = sortedCategories
      .slice(MAX_PIE_CATEGORIES)
      .reduce((acc, [, value]) => acc + value, 0);
    if (restante > 0) {
      costosPorCategoria.push({ name: "Otros", value: restante });
    }

    const costosMensualesMap: Record<string, number> = {};
    eventos.forEach((evento) => {
      const fecha = toDate(evento.fecha);
      if (!fecha) return;
      const monthKey = format(fecha, "yyyy-MM");
      costosMensualesMap[monthKey] = (costosMensualesMap[monthKey] || 0) + (evento.costoTotal || 0);
    });

    const ingresosMensualesMap: Record<string, number> = {};
    ventas.forEach((venta) => {
      const fecha = toDate(venta.fecha);
      if (!fecha) return;
      const monthKey = format(fecha, "yyyy-MM");
      ingresosMensualesMap[monthKey] = (ingresosMensualesMap[monthKey] || 0) + getIngresoVenta(venta);
    });

    const availableMonths = Array.from(
      new Set([...Object.keys(costosMensualesMap), ...Object.keys(ingresosMensualesMap)])
    ).sort((a, b) => a.localeCompare(b));

    const comparativoMensual =
      availableMonths.length === 0
        ? []
        : (() => {
            const latestMonth = availableMonths[availableMonths.length - 1];
            const latestDate = new Date(`${latestMonth}-01T00:00:00`);
            const monthRange = Array.from({ length: 6 }, (_, index) => {
              const monthDate = addMonths(latestDate, -(5 - index));
              return format(monthDate, "yyyy-MM");
            });

            return monthRange.map((monthKey) => {
              const costos = costosMensualesMap[monthKey] || 0;
              const ingresos = ingresosMensualesMap[monthKey] || 0;
              return {
                name: format(new Date(`${monthKey}-01T00:00:00`), "MMM yyyy"),
                costos,
                ingresos,
                margen: ingresos - costos,
              };
            });
          })();

    return {
      totalCostos,
      totalIngresos,
      margenNeto,
      margenPorcentual,
      rentabilidadPorParcela,
      rentabilidadPorCultivo,
      costosPorCategoria,
      comparativoMensual,
    };
  }, [eventos, ventas, parcelas, cultivos]);

  const isLoading = l1 || l2 || l3 || l4;
  if (isLoading) return <p>Cargando dashboard financiero...</p>;

  const topParcela = rentabilidadPorParcela[0];
  const peorParcela = rentabilidadPorParcela[rentabilidadPorParcela.length - 1];
  const topCultivo = rentabilidadPorCultivo[0];
  const peorParcelaEsNegativa = (peorParcela?.rentabilidad || 0) < 0;
  const ratioCostoIngreso = totalIngresos > 0 ? (totalCostos / totalIngresos) * 100 : 0;
  const soloOtros = costosPorCategoria.length === 1 && costosPorCategoria[0]?.name === "Otros";
  const shareSummary = `Ingresos: ${formatCurrency(totalIngresos)} | Costos: ${formatCurrency(totalCostos)} | Margen: ${formatCurrency(margenNeto)}.`;

  return (
    <>
      <PageHeader
        title="Dashboard Financiero"
        description="Analisis de costos, ingresos y rentabilidad del negocio agricola."
      >
        <ReportActions reportTitle="Dashboard Financiero" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area">
      <div className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalIngresos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Neto Consolidado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(margenNeto)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Sobre Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margenPorcentual.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relación Costo/Ingreso</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ratioCostoIngreso.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <ImpuestosSummary className="mb-6" />
      <ExecutiveAlerts className="mb-6" />

      <div className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Mejor Parcela</CardTitle>
            <Landmark className="h-4 w-4 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">{topParcela?.nombre || "N/A"}</div>
            <p className="text-xs text-primary/80">
              Margen: {formatCurrency(topParcela?.rentabilidad || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className={peorParcelaEsNegativa ? "bg-destructive/10" : "bg-muted/40"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${peorParcelaEsNegativa ? "text-destructive" : "text-foreground"}`}>
              {peorParcelaEsNegativa ? "Peor Parcela" : "Parcela con Menor Margen"}
            </CardTitle>
            <ChevronsDown className={`h-4 w-4 ${peorParcelaEsNegativa ? "text-destructive/70" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${peorParcelaEsNegativa ? "text-destructive" : "text-foreground"}`}>
              {peorParcela?.nombre || "N/A"}
            </div>
            <p className={`text-xs ${peorParcelaEsNegativa ? "text-destructive/80" : "text-muted-foreground"}`}>
              Margen: {formatCurrency(peorParcela?.rentabilidad || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cultivo Mas Rentable</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{topCultivo?.name || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              Margen: {formatCurrency(topCultivo?.rentabilidad || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Comparativo mensual de ingresos y costos</CardTitle>
            <CardDescription>Ultimos 6 meses con evolucion del margen.</CardDescription>
          </CardHeader>
          <CardContent>
            {comparativoMensual.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={comparativoMensual}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={12} tickFormatter={formatCompactCurrency} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={COMPARATIVE_CHART_COLORS.margen}
                    fontSize={12}
                    tickFormatter={formatCompactCurrency}
                  />
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="ingresos"
                    name="Ingresos"
                    fill={COMPARATIVE_CHART_COLORS.ingresos}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar yAxisId="left" dataKey="costos" name="Costos" fill={COMPARATIVE_CHART_COLORS.costo} radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="linear"
                    dataKey="margen"
                    name="Margen"
                    stroke={COMPARATIVE_CHART_COLORS.margen}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay suficientes datos para mostrar el comparativo mensual.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Costos por categoria</CardTitle>
            <CardDescription>Participacion de las principales categorias.</CardDescription>
          </CardHeader>
          <CardContent>
            {costosPorCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costosPorCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={({ name, percent }) =>
                      (percent || 0) >= 0.08 ? `${name} ${((percent || 0) * 100).toFixed(0)}%` : ""
                    }
                  >
                    {costosPorCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay costos cargados por categoria.</p>
            )}
            {soloOtros && (
              <p className="mt-3 text-xs text-muted-foreground">
                Todos los costos quedaron sin categoria. Puede mejorar la lectura clasificando `categoria` en eventos.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reporte de rentabilidad por parcela</CardTitle>
          <CardDescription>Detalle ordenado de mayor a menor margen neto.</CardDescription>
        </CardHeader>
        <CardContent>
          {rentabilidadPorParcela.length > 0 ? (
            <Table resizable className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Margen neto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentabilidadPorParcela.slice(0, 10).map((parcela) => {
                  const estado =
                    parcela.rentabilidad > 0 ? "Positivo" : parcela.rentabilidad < 0 ? "Negativo" : "Neutro";
                  return (
                    <TableRow key={parcela.nombre}>
                      <TableCell className="font-medium">{parcela.nombre}</TableCell>
                      <TableCell className="text-right">{formatCurrency(parcela.rentabilidad)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            estado === "Positivo" ? "secondary" : estado === "Negativo" ? "destructive" : "outline"
                          }
                        >
                          {estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay datos de rentabilidad por parcela para mostrar.
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}


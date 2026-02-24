"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { collection } from "firebase/firestore";
import {
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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cultivo, Evento, Parcela, Venta } from "@/lib/types";

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
  return `$${value.toLocaleString("en-US")}`;
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export default function DashboardFinancieroPage() {
  const firestore = useFirestore();

  const { data: eventos, isLoading: l1 } = useCollection<Evento>(
    useMemoFirebase(() => (firestore ? collection(firestore, "eventos") : null), [firestore])
  );
  const { data: ventas, isLoading: l2 } = useCollection<Venta>(
    useMemoFirebase(() => (firestore ? collection(firestore, "ventas") : null), [firestore])
  );
  const { data: parcelas, isLoading: l3 } = useCollection<Parcela>(
    useMemoFirebase(() => (firestore ? collection(firestore, "parcelas") : null), [firestore])
  );
  const { data: cultivos, isLoading: l4 } = useCollection<Cultivo>(
    useMemoFirebase(() => (firestore ? collection(firestore, "cultivos") : null), [firestore])
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
    const totalIngresos = ventas.reduce(
      (acc, venta) => acc + (venta.toneladas || 0) * (venta.precioTonelada || 0),
      0
    );
    const margenNeto = totalIngresos - totalCostos;
    const margenPorcentual = totalIngresos > 0 ? (margenNeto / totalIngresos) * 100 : 0;

    const rentabilidadPorParcela = parcelas
      .map((parcela) => {
        const costosParcela = eventos
          .filter((evento) => evento.parcelaId === parcela.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        const ingresosParcela = ventas
          .filter((venta) => venta.parcelaId === parcela.id)
          .reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
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
          .reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
        return {
          name: cultivo.nombre,
          rentabilidad: ingresosCultivo - costosCultivo,
        };
      })
      .sort((a, b) => b.rentabilidad - a.rentabilidad)
      .filter((item) => item.rentabilidad !== 0);

    const costosPorCategoriaMap = eventos.reduce((acc, evento) => {
      const categoria = evento.categoria || "Otros";
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
      ingresosMensualesMap[monthKey] =
        (ingresosMensualesMap[monthKey] || 0) + (venta.toneladas || 0) * (venta.precioTonelada || 0);
    });

    const comparativoMensual = Array.from(
      new Set([...Object.keys(costosMensualesMap), ...Object.keys(ingresosMensualesMap)])
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(-6)
      .map((monthKey) => {
        const costos = costosMensualesMap[monthKey] || 0;
        const ingresos = ingresosMensualesMap[monthKey] || 0;
        return {
          name: format(new Date(`${monthKey}-01T00:00:00`), "MMM yyyy"),
          costos,
          ingresos,
          margen: ingresos - costos,
        };
      });

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
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
        <Card className="bg-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Peor Parcela</CardTitle>
            <ChevronsDown className="h-4 w-4 text-destructive/70" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">{peorParcela?.nombre || "N/A"}</div>
            <p className="text-xs text-destructive/80">
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
                  <YAxis stroke="#888888" fontSize={12} tickFormatter={formatCompactCurrency} />
                  <Tooltip
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costos" name="Costos" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="margen"
                    name="Margen"
                    stroke="hsl(var(--primary))"
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
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {costosPorCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay costos cargados por categoria.</p>
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
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Margen neto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentabilidadPorParcela.slice(0, 10).map((parcela) => (
                  <TableRow key={parcela.nombre}>
                    <TableCell className="font-medium">{parcela.nombre}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parcela.rentabilidad)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parcela.rentabilidad >= 0 ? "secondary" : "destructive"}>
                        {parcela.rentabilidad >= 0 ? "Positivo" : "Negativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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

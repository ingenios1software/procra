"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cultivo, Evento, Parcela, Venta } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RentabilidadPage() {
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

  const isLoading = l1 || l2 || l3 || l4;

  const {
    totalIngresos,
    totalCostos,
    rentabilidadTotal,
    rentabilidadPorCultivo,
    rentabilidadPorParcela,
    composicionIngresos,
  } = useMemo(() => {
    if (!eventos || !ventas || !parcelas || !cultivos) {
      return {
        totalIngresos: 0,
        totalCostos: 0,
        rentabilidadTotal: 0,
        rentabilidadPorCultivo: [],
        rentabilidadPorParcela: [],
        composicionIngresos: [],
      };
    }

    const totalIngresos = ventas.reduce(
      (sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0),
      0
    );
    const totalCostos = eventos.reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);

    const rentabilidadPorCultivo = cultivos
      .map((cultivo) => {
        const costosCultivo = eventos
          .filter((evento) => evento.cultivoId === cultivo.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        const ingresosCultivo = ventas
          .filter((venta) => venta.cultivoId === cultivo.id)
          .reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
        const rentabilidadNeta = ingresosCultivo - costosCultivo;
        const margen = ingresosCultivo > 0 ? (rentabilidadNeta / ingresosCultivo) * 100 : 0;
        return {
          name: cultivo.nombre,
          ingresos: ingresosCultivo,
          costos: costosCultivo,
          rentabilidad: rentabilidadNeta,
          margen,
        };
      })
      .filter((item) => item.ingresos > 0 || item.costos > 0)
      .sort((a, b) => b.rentabilidad - a.rentabilidad);

    const rentabilidadPorParcela = parcelas
      .map((parcela) => {
        const costosParcela = eventos
          .filter((evento) => evento.parcelaId === parcela.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        // Las ventas no se relacionan con parcelas; este margen refleja costos directos por parcela.
        const ingresosParcela = 0;
        const margenNeto = ingresosParcela - costosParcela;
        const margenPorHa = parcela.superficie > 0 ? margenNeto / parcela.superficie : 0;
        const margenPercent = ingresosParcela > 0 ? (margenNeto / ingresosParcela) * 100 : 0;

        let colorClass = "text-green-600";
        if (margenPercent < 0) colorClass = "text-red-600";
        else if (margenPercent <= 10) colorClass = "text-yellow-600";

        return {
          name: parcela.nombre,
          margenNeto,
          margenPorHa,
          colorClass,
        };
      })
      .filter((item) => item.margenNeto !== 0)
      .sort((a, b) => b.margenNeto - a.margenNeto);

    const composicionIngresos = cultivos
      .map((cultivo) => {
        const ingresosCultivo = ventas
          .filter((venta) => venta.cultivoId === cultivo.id)
          .reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
        return {
          name: cultivo.nombre,
          value: ingresosCultivo,
        };
      })
      .filter((item) => item.value > 0);

    return {
      totalIngresos,
      totalCostos,
      rentabilidadTotal: totalIngresos - totalCostos,
      rentabilidadPorCultivo,
      rentabilidadPorParcela,
      composicionIngresos,
    };
  }, [eventos, ventas, cultivos, parcelas]);

  if (isLoading) {
    return <p>Cargando datos de rentabilidad...</p>;
  }

  const shareSummary = `Ingresos: ${formatCurrency(totalIngresos)} | Costos: ${formatCurrency(totalCostos)} | Rentabilidad: ${formatCurrency(rentabilidadTotal)}.`;

  return (
    <>
      <PageHeader
        title="Analisis de Rentabilidad"
        description="Evaluacion de rentabilidad por cultivo y por parcela."
      >
        <ReportActions reportTitle="Analisis de Rentabilidad" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <div className="grid gap-6 md:grid-cols-3 mb-6">
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
          <Card className="bg-primary/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Rentabilidad Total</CardTitle>
              <DollarSign className="h-4 w-4 text-primary/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(rentabilidadTotal)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Rentabilidad por Cultivo</CardTitle>
            <CardDescription>Ingresos, costos y margen por cada cultivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cultivo</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Costos</TableHead>
                  <TableHead className="text-right">Rentabilidad</TableHead>
                  <TableHead className="text-right">Margen (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentabilidadPorCultivo.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.ingresos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.costos)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        item.rentabilidad > 0 ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {formatCurrency(item.rentabilidad)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        item.margen > 10 ? "text-green-600" : item.margen > 0 ? "text-yellow-600" : "text-red-600"
                      )}
                    >
                      {item.margen.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Margen por Lote</CardTitle>
            <CardDescription>Margen neto y margen por hectarea para cada lote.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Margen Neto</TableHead>
                  <TableHead className="text-right">Margen/ha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentabilidadPorParcela.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className={cn("text-right font-semibold", item.colorClass)}>
                      {formatCurrency(item.margenNeto)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", item.colorClass)}>
                      {formatCurrency(item.margenPorHa)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Grafico de Rentabilidad por Cultivo</CardTitle>
            </CardHeader>
            <CardContent>
              {rentabilidadPorCultivo.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rentabilidadPorCultivo} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                    <Tooltip
                      formatter={(value) => `$${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      cursor={{ fill: "hsla(var(--muted))" }}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Bar dataKey="rentabilidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No hay datos de rentabilidad por cultivo.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Composicion de Ingresos por Cultivo</CardTitle>
            </CardHeader>
            <CardContent>
              {composicionIngresos.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={composicionIngresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {composicionIngresos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `$${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No hay datos de composicion de ingresos.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}


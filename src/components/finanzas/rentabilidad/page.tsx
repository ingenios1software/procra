"use client";

import { useMemo } from "react";
import { collection, query } from "firebase/firestore";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Costo, Cultivo, Parcela, Venta } from "@/lib/types";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function RentabilidadPage() {
  const firestore = useFirestore();

  const { data: costos } = useCollection<Costo>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "costos")) : null), [firestore])
  );
  const { data: ventas } = useCollection<Venta>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "ventas")) : null), [firestore])
  );
  const { data: cultivos } = useCollection<Cultivo>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "cultivos")) : null), [firestore])
  );
  const { data: parcelas } = useCollection<Parcela>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "parcelas")) : null), [firestore])
  );

  const {
    totalIngresos,
    totalCostos,
    rentabilidadTotal,
    rentabilidadPorCultivo,
    rentabilidadPorParcela,
    composicionIngresos,
  } = useMemo(() => {
    if (!costos || !ventas || !cultivos || !parcelas) {
      return {
        totalIngresos: 0,
        totalCostos: 0,
        rentabilidadTotal: 0,
        rentabilidadPorCultivo: [],
        rentabilidadPorParcela: [],
        composicionIngresos: [],
      };
    }

    const totalIngresos = ventas.reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
    const totalCostos = costos.reduce((sum, costo) => sum + costo.monto, 0);

    const rentabilidadPorCultivo = cultivos
      .map((cultivo) => {
        const costosCultivo = costos
          .filter((costo) => costo.cultivoId === cultivo.id)
          .reduce((sum, costo) => sum + costo.monto, 0);
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
      .filter((item) => item.ingresos > 0 || item.costos > 0);

    const rentabilidadPorParcela = parcelas
      .map((parcela) => {
        const costosParcela = costos
          .filter((costo) => costo.parcelaId === parcela.id)
          .reduce((sum, costo) => sum + costo.monto, 0);
        const ingresosParcela = ventas
          .filter((venta) => venta.parcelaId === parcela.id)
          .reduce((sum, venta) => sum + (venta.toneladas || 0) * (venta.precioTonelada || 0), 0);
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
      .filter((item) => item.margenNeto !== 0);

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
  }, [costos, ventas, cultivos, parcelas]);

  const shareSummary = `Rentabilidad total: $${rentabilidadTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;

  return (
    <>
      <PageHeader
        title="Analisis de Rentabilidad"
        description="Evalue la rentabilidad de sus cultivos y parcelas."
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
              <div className="text-2xl font-bold">${totalIngresos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCostos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card className="bg-primary/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Rentabilidad Total</CardTitle>
              <DollarSign className="h-4 w-4 text-primary/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${rentabilidadTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Rentabilidad por Cultivo</CardTitle>
            <CardDescription>Analisis de ingresos, costos y margen por cultivo.</CardDescription>
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
                    <TableCell className="text-right">${item.ingresos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">${item.costos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className={cn("text-right font-semibold", item.rentabilidad > 0 ? "text-green-600" : "text-red-600")}>
                      ${item.rentabilidad.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <CardDescription>Margen neto y por hectarea para cada lote.</CardDescription>
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
                      ${item.margenNeto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", item.colorClass)}>
                      ${item.margenPorHa.toFixed(2)}
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Composicion de Ingresos por Cultivo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={composicionIngresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {composicionIngresos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: "hsl(var(--background))" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}


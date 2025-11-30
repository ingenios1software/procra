"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DollarSign, TrendingDown, TrendingUp, Landmark, Star, ChevronsDown } from "lucide-react";
import { format } from "date-fns";
import { useDataStore } from "@/store/data-store";
import { Costo, Venta, Parcela, Cultivo } from "@/lib/types";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardFinancieroPage() {
  const { costos, ventas, parcelas, cultivos } = useDataStore();

  const { totalCostos, totalIngresos, margenNeto, rentabilidadPorParcela, rentabilidadPorCultivo, costosPorCategoria, costosMensuales } = useMemo(() => {
    if (!costos || !ventas || !parcelas || !cultivos) return { totalCostos: 0, totalIngresos: 0, margenNeto: 0, rentabilidadPorParcela: [], rentabilidadPorCultivo: [], costosPorCategoria: [], costosMensuales: [] };

    const totalCostos = costos.reduce((acc, costo) => acc + costo.monto, 0);
    const totalIngresos = ventas.reduce((acc, venta) => acc + venta.toneladas * venta.precioTonelada, 0);
    const margenNeto = totalIngresos - totalCostos;

    const rentabilidadPorParcela = parcelas.map(parcela => {
      const costosParcela = costos.filter(c => c.parcelaId === parcela.id).reduce((sum, c) => sum + c.monto, 0);
      const ingresosParcela = ventas.filter(v => v.parcelaId === parcela.id).reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
      return {
        nombre: parcela.nombre,
        rentabilidad: ingresosParcela - costosParcela,
      };
    }).sort((a, b) => b.rentabilidad - a.rentabilidad);

    const rentabilidadPorCultivo = cultivos.map(cultivo => {
      const costosCultivo = costos.filter(c => c.cultivoId === cultivo.id).reduce((sum, c) => sum + c.monto, 0);
      const ingresosCultivo = ventas.filter(v => v.cultivoId === cultivo.id).reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
      return {
        name: cultivo.nombre,
        rentabilidad: ingresosCultivo - costosCultivo,
      };
    }).sort((a,b) => b.rentabilidad - a.rentabilidad);

    const costosPorCategoria = costos.reduce((acc, costo) => {
      acc[costo.tipo] = (acc[costo.tipo] || 0) + costo.monto;
      return acc;
    }, {} as Record<string, number>);
    const costosCategoriaData = Object.entries(costosPorCategoria).map(([name, value]) => ({ name, value }));

    const costosMensuales = costos.reduce((acc, costo) => {
      const month = format(new Date(costo.fecha), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + costo.monto;
      return acc;
    }, {} as Record<string, number>);
    const costosMensualesData = Object.entries(costosMensuales).map(([name, total]) => ({ name, total })).slice(-6);

    return { totalCostos, totalIngresos, margenNeto, rentabilidadPorParcela, rentabilidadPorCultivo, costosPorCategoria: costosCategoriaData, costosMensuales: costosMensualesData };
  }, [costos, ventas, parcelas, cultivos]);

  const topParcela = rentabilidadPorParcela[0];
  const peorParcela = rentabilidadPorParcela[rentabilidadPorParcela.length - 1];
  const topCultivo = rentabilidadPorCultivo[0];

  return (
    <>
      <PageHeader
        title="Dashboard Financiero"
        description="Análisis de costos, ingresos y rentabilidad del negocio agrícola."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalIngresos.toLocaleString('en-US')}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costos Totales</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalCostos.toLocaleString('en-US')}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Margen Neto Consolidado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">${margenNeto.toLocaleString('en-US')}</div></CardContent>
        </Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card className="bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Mejor Parcela</CardTitle><Landmark className="h-4 w-4 text-primary/70" /></CardHeader>
          <CardContent><div className="text-xl font-bold text-primary">{topParcela?.nombre || 'N/A'}</div><p className="text-xs text-primary/80">Margen: ${topParcela?.rentabilidad.toLocaleString('en-US') || '0'}</p></CardContent>
        </Card>
        <Card className="bg-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-destructive">Peor Parcela</CardTitle><ChevronsDown className="h-4 w-4 text-destructive/70" /></CardHeader>
          <CardContent><div className="text-xl font-bold text-destructive">{peorParcela?.nombre || 'N/A'}</div><p className="text-xs text-destructive/80">Margen: ${peorParcela?.rentabilidad.toLocaleString('en-US') || '0'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cultivo Más Rentable</CardTitle><Star className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-xl font-bold">{topCultivo?.name || 'N/A'}</div><p className="text-xs text-muted-foreground">Margen: ${topCultivo?.rentabilidad.toLocaleString('en-US') || '0'}</p></CardContent>
        </Card>
      </div>

       <div className="grid gap-6 mt-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader><CardTitle>Costos Mensuales (Últimos 6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costosMensuales}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${Number(value)/1000}k`} />
                <Tooltip cursor={{ fill: 'hsla(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))' }} formatter={(value) => `$${Number(value).toLocaleString('en-US')}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Costos por Categoría</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={costosPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {costosPorCategoria.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString('en-US')}`} contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
                </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

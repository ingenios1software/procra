
"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, Download } from "lucide-react";
import { mockCostos, mockVentas, mockCultivos, mockParcelas } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function RentabilidadPage() {
  const { totalIngresos, totalCostos, rentabilidadTotal, rentabilidadPorCultivo, rentabilidadPorParcela, composicionIngresos } = useMemo(() => {
    const totalIngresos = mockVentas.reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
    const totalCostos = mockCostos.reduce((sum, c) => sum + c.monto, 0);
    
    const rentabilidadPorCultivo = mockCultivos.map(cultivo => {
      const costosCultivo = mockCostos.filter(c => c.cultivoId === cultivo.id).reduce((sum, c) => sum + c.monto, 0);
      const ingresosCultivo = mockVentas.filter(v => v.cultivoId === cultivo.id).reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
      const rentabilidadNeta = ingresosCultivo - costosCultivo;
      const margen = ingresosCultivo > 0 ? (rentabilidadNeta / ingresosCultivo) * 100 : 0;
      return {
        name: cultivo.nombre,
        ingresos: ingresosCultivo,
        costos: costosCultivo,
        rentabilidad: rentabilidadNeta,
        margen: margen,
      };
    }).filter(c => c.ingresos > 0 || c.costos > 0);

    const rentabilidadPorParcela = mockParcelas.map(parcela => {
      const costosParcela = mockCostos.filter(c => c.parcelaId === parcela.id).reduce((sum, c) => sum + c.monto, 0);
      const ingresosParcela = mockVentas.filter(v => v.parcelaId === parcela.id).reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
      const margenNeto = ingresosParcela - costosParcela;
      const margenPorHa = parcela.superficie > 0 ? margenNeto / parcela.superficie : 0;
      const margenPercent = ingresosParcela > 0 ? (margenNeto / ingresosParcela) * 100 : 0;
      
      let colorClass = 'text-green-600';
      if (margenPercent < 0) colorClass = 'text-red-600';
      else if (margenPercent <= 10) colorClass = 'text-yellow-600';

      return {
        name: parcela.nombre,
        margenNeto: margenNeto,
        margenPorHa: margenPorHa,
        colorClass,
      };
    }).filter(p => p.margenNeto !== 0);

    const composicionIngresos = mockCultivos.map(cultivo => {
      const ingresosCultivo = mockVentas
        .filter(v => v.cultivoId === cultivo.id)
        .reduce((sum, v) => sum + v.toneladas * v.precioTonelada, 0);
      return {
        name: cultivo.nombre,
        value: ingresosCultivo,
      };
    }).filter(item => item.value > 0);

    return {
      totalIngresos,
      totalCostos,
      rentabilidadTotal: totalIngresos - totalCostos,
      rentabilidadPorCultivo,
      rentabilidadPorParcela,
      composicionIngresos
    };
  }, []);

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Análisis de Rentabilidad"
        description="Evalúe la rentabilidad de sus cultivos y parcelas."
      >
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${totalIngresos.toLocaleString('en-US')}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costos Totales</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${totalCostos.toLocaleString('en-US')}</div></CardContent></Card>
        <Card className="bg-primary/10"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Rentabilidad Total</CardTitle><DollarSign className="h-4 w-4 text-primary/70" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">${rentabilidadTotal.toLocaleString('en-US')}</div></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
            <CardTitle>Rentabilidad por Cultivo</CardTitle>
            <CardDescription>Análisis de ingresos, costos y margen por cada cultivo.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Cultivo</TableHead><TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">Costos</TableHead><TableHead className="text-right">Rentabilidad</TableHead><TableHead className="text-right">Margen (%)</TableHead></TableRow></TableHeader>
                <TableBody>
                    {rentabilidadPorCultivo.map(c => (
                        <TableRow key={c.name}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-right">${c.ingresos.toLocaleString('en-US')}</TableCell>
                            <TableCell className="text-right">${c.costos.toLocaleString('en-US')}</TableCell>
                            <TableCell className={cn("text-right font-semibold", c.rentabilidad > 0 ? "text-green-600" : "text-red-600")}>${c.rentabilidad.toLocaleString('en-US')}</TableCell>
                            <TableCell className={cn("text-right font-semibold", c.margen > 10 ? "text-green-600" : c.margen > 0 ? "text-yellow-600" : "text-red-600")}>{c.margen.toFixed(2)}%</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
            <CardTitle>Margen por Lote</CardTitle>
            <CardDescription>Análisis de margen neto y por hectárea para cada lote.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Parcela</TableHead><TableHead className="text-right">Margen Neto</TableHead><TableHead className="text-right">Margen/ha</TableHead></TableRow></TableHeader>
                <TableBody>
                    {rentabilidadPorParcela.map(p => (
                        <TableRow key={p.name}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className={cn("text-right font-semibold", p.colorClass)}>${p.margenNeto.toLocaleString('en-US')}</TableCell>
                            <TableCell className={cn("text-right font-semibold", p.colorClass)}>${p.margenPorHa.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Gráfico de Rentabilidad por Cultivo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rentabilidadPorCultivo} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${Number(value)/1000}k`} />
                <Tooltip 
                  formatter={(value) => `$${Number(value).toLocaleString('en-US')}`}
                  cursor={{ fill: 'hsla(var(--muted))' }} 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
                <Bar dataKey="rentabilidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Composición de Ingresos por Cultivo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={composicionIngresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label >
                    {composicionIngresos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString('en-US')}`} contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

    
"use client";

import { useMemo } from "react";
import { notFound, useRouter } from "next/navigation";
import { useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { orderBy, where } from "firebase/firestore";
import type { Parcela, Evento, Cultivo, Zafra, Insumo } from "@/lib/types";

import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, Tractor, Droplets, CalendarDays } from "lucide-react";
import { CartesianGrid, Legend, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function ParcelaCostoReportePage({ params }: { params: { id: string } }) {
  const tenant = useTenantFirestore();
  const router = useRouter();

  const parcelaRef = useMemoFirebase(() => tenant.doc("parcelas", params.id), [tenant, params.id]);
  const { data: parcela, isLoading: l1 } = useDoc<Parcela>(parcelaRef);

  const eventosQuery = useMemoFirebase(
    () => tenant.query("eventos", where("parcelaId", "==", params.id), orderBy("fecha")),
    [tenant, params.id]
  );
  const { data: eventos, isLoading: l2 } = useCollection<Evento>(eventosQuery);

  const insumosQuery = useMemoFirebase(() => tenant.collection("insumos"), [tenant]);
  const { data: insumos, isLoading: l3 } = useCollection<Insumo>(insumosQuery);

  const zafrasQuery = useMemoFirebase(() => tenant.collection("zafras"), [tenant]);
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(zafrasQuery);

  const cultivosQuery = useMemoFirebase(() => tenant.collection("cultivos"), [tenant]);
  const { data: cultivos, isLoading: l5 } = useCollection<Cultivo>(cultivosQuery);

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const {
    zafra,
    cultivo,
    costoTotal,
    costoPorHa,
    totalInsumos,
    totalServicios,
    ultimoEvento,
    costosPorTipoEvento,
    topInsumos,
    costoAcumulado,
  } = useMemo(() => {
    if (!parcela || !eventos || !insumos || !zafras || !cultivos) {
      return { costosPorTipoEvento: [], topInsumos: [], costoAcumulado: [] };
    }

    const zafraActiva = zafras.find((zafraItem) => eventos.some((evento) => evento.zafraId === zafraItem.id));
    const cultivoAsociado = zafraActiva
      ? cultivos.find((cultivoItem) => cultivoItem.id === zafraActiva.cultivoId)
      : null;

    const costoTotal = eventos.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
    const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;

    const totalServicios = eventos.reduce(
      (sum, ev) => sum + ((ev.hectareasAplicadas || 0) * (ev.costoServicioPorHa || 0)),
      0
    );
    const totalInsumos = costoTotal - totalServicios;

    const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;

    const costosPorTipo = eventos.reduce((acc, ev) => {
      const tipo = ev.categoria || ev.tipo;
      acc[tipo] = (acc[tipo] || 0) + (ev.costoTotal || 0);
      return acc;
    }, {} as Record<string, number>);
    const costosPorTipoEvento = Object.entries(costosPorTipo).map(([name, value]) => ({ name, value }));

    const insumosCostos = eventos
      .flatMap((evento) => evento.productos || [])
      .reduce((acc, prod) => {
        const insumo = insumos.find((item) => item.id === prod.insumoId);
        if (!insumo) return acc;

        const costo = prod.cantidad * (insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
        acc[insumo.nombre] = acc[insumo.nombre] || { costo: 0, cantidad: 0, unidad: insumo.unidad };
        acc[insumo.nombre].costo += costo;
        acc[insumo.nombre].cantidad += prod.cantidad;
        return acc;
      }, {} as Record<string, { costo: number; cantidad: number; unidad: string }>);

    const topInsumos = Object.entries(insumosCostos)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.costo - a.costo)
      .slice(0, 10);

    let acumulado = 0;
    const costoAcumulado = eventos.map((ev) => {
      acumulado += ev.costoTotal || 0;
      return {
        fecha: format(new Date(ev.fecha as string), "dd/MM"),
        costoAcumulado: acumulado,
      };
    });

    return {
      zafra: zafraActiva,
      cultivo: cultivoAsociado,
      costoTotal,
      costoPorHa,
      totalInsumos,
      totalServicios,
      ultimoEvento,
      costosPorTipoEvento,
      topInsumos,
      costoAcumulado,
    };
  }, [parcela, eventos, insumos, zafras, cultivos]);

  if (isLoading) return <p>Cargando reporte de costos...</p>;
  if (!parcela) return notFound();

  const shareSummary = `Parcela: ${parcela.nombre} | Costo total: $${(costoTotal || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} | Eventos con costo: ${eventos?.filter((evento) => evento.costoTotal && evento.costoTotal > 0).length || 0}.`;

  return (
    <>
      <PageHeader
        title={`Reporte de Costos: ${parcela.nombre}`}
        description={`AnÃ¡lisis financiero para la campaÃ±a ${zafra?.nombre || "N/A"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions reportTitle={`Reporte de Costos: ${parcela.nombre}`} reportSummary={shareSummary} />
          <Button onClick={() => router.push("/parcelas")}>Volver a Parcelas</Button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {costoTotal?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Costo Prom./ha</CardTitle>
            <DollarSign />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${costoPorHa?.toFixed(2) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Costo Insumos</CardTitle>
            <Droplets />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalInsumos?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Costo Servicios</CardTitle>
            <Tractor />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalServicios?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ãšltimo Evento</CardTitle>
            <CalendarDays />
          </CardHeader>
          <CardContent>
            <div className="text-md font-bold">{ultimoEvento?.descripcion}</div>
            <p className="text-xs text-muted-foreground">
              $
              {(ultimoEvento?.costoTotal || 0).toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>DistribuciÃ³n de Costos</CardTitle>
            <CardDescription>Por tipo de evento</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={costosPorTipoEvento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {costosPorTipoEvento?.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `$${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Costo Acumulado</CardTitle>
            <CardDescription>EvoluciÃ³n del gasto durante la campaÃ±a</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={costoAcumulado}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                <Tooltip
                  formatter={(value: number) =>
                    `$${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="costoAcumulado"
                  stroke={COMPARATIVE_CHART_COLORS.costo}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Top Insumos por Costo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Cantidad Usada</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topInsumos?.map((insumo) => (
                <TableRow key={insumo.nombre}>
                  <TableCell className="font-medium">{insumo.nombre}</TableCell>
                  <TableCell>
                    {insumo.cantidad.toFixed(2)} {insumo.unidad}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    $
                    {insumo.costo.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos EconÃ³micos de la Parcela</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>DescripciÃ³n</TableHead>
                <TableHead className="text-right">Costo Insumos</TableHead>
                <TableHead className="text-right">Costo Servicio</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead className="text-right">Costo/ha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos?.filter((evento) => evento.costoTotal && evento.costoTotal > 0).map((evento) => {
                const costoServ = (evento.hectareasAplicadas || 0) * (evento.costoServicioPorHa || 0);
                const costoIns = (evento.costoTotal || 0) - costoServ;

                return (
                  <TableRow key={evento.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>{format(new Date(evento.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{evento.categoria || evento.tipo}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{evento.descripcion}</TableCell>
                    <TableCell className="text-right font-mono">
                      $
                      {costoIns.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      $
                      {costoServ.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono">
                      $
                      {(evento.costoTotal || 0).toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono">
                      ${(evento.costoPorHa || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

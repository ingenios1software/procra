"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { orderBy } from "firebase/firestore";
import { DollarSign, FileText } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCollection, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Evento, Parcela, Zafra } from "@/lib/types";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function CostosPage() {
  const tenant = useTenantFirestore();

  const { data: eventos, isLoading: l1 } = useCollection<Evento>(
    useMemoFirebase(() => tenant.query("eventos", orderBy("fecha", "desc")), [tenant])
  );
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(
    useMemoFirebase(() => tenant.collection("parcelas"), [tenant])
  );
  const { data: zafras, isLoading: l3 } = useCollection<Zafra>(
    useMemoFirebase(() => tenant.collection("zafras"), [tenant])
  );

  const isLoading = l1 || l2 || l3;

  const { totalCostosEventos, costosPorZafra, costosCombinados } = useMemo(() => {
    if (!eventos || !zafras) {
      return { totalCostosEventos: 0, costosPorZafra: [], costosCombinados: [] };
    }

    const costosEventos = eventos.reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
    const costosZafraData = zafras
      .map((zafra) => {
        const costoEventos = eventos
          .filter((evento) => evento.zafraId === zafra.id)
          .reduce((sum, evento) => sum + (evento.costoTotal || 0), 0);
        return { name: zafra.nombre, costo: costoEventos };
      })
      .filter((item) => item.costo > 0);

    const todosLosCostos = [
      ...eventos.map((evento) => ({
        fecha: evento.fecha,
        descripcion: evento.descripcion,
        tipo: "Evento",
        monto: evento.costoTotal || 0,
        parcelaId: evento.parcelaId,
        zafraId: evento.zafraId,
        categoria: evento.categoria || evento.tipo,
      })),
    ].sort((a, b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime());

    return {
      totalCostosEventos: costosEventos,
      costosPorZafra: costosZafraData,
      costosCombinados: todosLosCostos,
    };
  }, [eventos, zafras]);

  const totalGeneral = totalCostosEventos;
  const getNombre = (id: string, coleccion: Array<{ id: string; nombre: string }> | null) =>
    coleccion?.find((item) => item.id === id)?.nombre || "N/A";

  const shareSummary = `Costos totales: $${totalGeneral.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;

  return (
    <>
      <PageHeader
        title="Gestion de Costos Operativos"
        description="Analisis consolidado de costos de eventos de campo."
      >
        <ReportActions reportTitle="Gestion de Costos Operativos" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo Total de Eventos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalGeneral.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Suma de todos los costos de eventos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo por Eventos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCostosEventos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Total de actividades con costos</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Costos por Zafra (Eventos)</CardTitle>
            <CardDescription>Visualizacion de costos de eventos por campana agricola.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costosPorZafra}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                <Tooltip
                  formatter={(value) => `$${typeof value === "number" ? value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`}
                  cursor={{ fill: "hsla(var(--muted))" }}
                  contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                />
                <Bar dataKey="costo" fill={COMPARATIVE_CHART_COLORS.costo} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado Detallado de Costos de Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Tipo/Categoria</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Zafra</TableHead>
                  <TableHead className="text-right">Costo Total ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando costos...
                    </TableCell>
                  </TableRow>
                )}
                {costosCombinados?.map((costo, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(costo.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{costo.descripcion}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {costo.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>{getNombre(costo.parcelaId, parcelas || null)}</TableCell>
                    <TableCell>{getNombre(costo.zafraId, zafras || null)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ${(costo.monto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && costosCombinados?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No hay costos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


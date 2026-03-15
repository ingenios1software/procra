"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { where } from "firebase/firestore";
import type { Zafra, Parcela, Evento, Cultivo, Insumo } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Ruler, Activity, CalendarDays, Sprout, SprayCan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { getEventTypeDisplay, getTipoBaseFromEvento } from "@/lib/eventos/tipos";

export default function ZafraReportePage({ params }: { params: { id: string } }) {
  const tenant = useTenantFirestore();

  const zafraRef = useMemoFirebase(() => tenant.doc("zafras", params.id), [tenant, params.id]);
  const { data: zafra, isLoading: l1 } = useDoc<Zafra>(zafraRef);

  const parcelasQuery = useMemoFirebase(() => tenant.collection("parcelas"), [tenant]);
  const { data: todasParcelas, isLoading: l2 } = useCollection<Parcela>(parcelasQuery);

  const eventosQuery = useMemoFirebase(
    () => tenant.query("eventos", where("zafraId", "==", params.id)),
    [tenant, params.id]
  );
  const { data: eventos, isLoading: l3 } = useCollection<Evento>(eventosQuery);

  const cultivosQuery = useMemoFirebase(() => tenant.collection("cultivos"), [tenant]);
  const { data: cultivos, isLoading: l4 } = useCollection<Cultivo>(cultivosQuery);

  const insumosQuery = useMemoFirebase(() => tenant.collection("insumos"), [tenant]);
  const { data: insumos, isLoading: l5 } = useCollection<Insumo>(insumosQuery);

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const {
    parcelasEnZafra,
    cultivoPrincipal,
    superficieTotal,
    kpis,
    actividadPorTipo,
    insumosMasUsados,
  } = useMemo(() => {
    if (!zafra || !todasParcelas || !eventos || !cultivos) {
      return {
        parcelasEnZafra: [],
        cultivoPrincipal: null,
        superficieTotal: 0,
        kpis: {
          parcelas: 0,
          superficie: 0,
          eventos: 0,
          aplicaciones: 0,
          fertilizaciones: 0,
          monitoreos: 0,
          labores: 0,
          cosechas: 0,
          ultimaActividad: null,
        },
        actividadPorTipo: [],
        insumosMasUsados: [],
      };
    }

    const idParcelasEnZafra = new Set(eventos.map((evento) => evento.parcelaId));
    const parcelasEnZafra = todasParcelas.filter((parcela) => idParcelasEnZafra.has(parcela.id));
    const superficieTotal = parcelasEnZafra.reduce((sum, parcela) => sum + parcela.superficie, 0);
    const cultivoPrincipal = cultivos.find((cultivo) => cultivo.id === zafra.cultivoId) || null;

    const eventosPorTipoBase = eventos.reduce((acc, evento) => {
      const tipoBase = getTipoBaseFromEvento(evento.tipo);
      acc[tipoBase] = (acc[tipoBase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const actividadPorTipoMap = eventos.reduce((acc, evento) => {
      const tipoVisible = getEventTypeDisplay(evento);
      acc[tipoVisible] = (acc[tipoVisible] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const ultimoEvento = [...eventos].sort(
      (a, b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime()
    )[0];

    const insumosConsumidos = eventos
      .flatMap((evento) => evento.productos || [])
      .reduce((acc, prod) => {
        const insumo = insumos?.find((item) => item.id === prod.insumoId);
        const insumoNombre = insumo?.nombre || "Desconocido";
        const unidad = insumo?.unidad || "";
        const categoria = insumo?.categoria || "otros";

        if (!acc[insumoNombre]) {
          acc[insumoNombre] = { cantidad: 0, unidad, categoria };
        }
        acc[insumoNombre].cantidad += prod.cantidad || 0;
        return acc;
      }, {} as Record<string, { cantidad: number; unidad: string; categoria: string }>);

    const insumosMasUsados = Object.entries(insumosConsumidos)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const kpis = {
      parcelas: parcelasEnZafra.length,
      superficie: superficieTotal,
      eventos: eventos.length,
      aplicaciones: eventosPorTipoBase["aplicacion"] || 0,
      fertilizaciones: eventosPorTipoBase["fertilizacion"] || 0,
      monitoreos: eventosPorTipoBase["monitoreo"] || 0,
      labores: eventosPorTipoBase["mantenimiento"] || 0,
      cosechas: eventosPorTipoBase["cosecha"] || 0,
      ultimaActividad: ultimoEvento ? new Date(ultimoEvento.fecha as string) : null,
    };

    return {
      parcelasEnZafra,
      cultivoPrincipal,
      superficieTotal,
      kpis,
      actividadPorTipo: Object.entries(actividadPorTipoMap)
        .map(([name, value]) => ({ name, Cantidad: value }))
        .sort((a, b) => b.Cantidad - a.Cantidad),
      insumosMasUsados,
    };
  }, [zafra, todasParcelas, eventos, cultivos, insumos]);

  if (isLoading) {
    return <p>Cargando reporte de zafra...</p>;
  }

  if (!zafra) {
    return notFound();
  }

  const shareSummary = `Zafra: ${zafra.nombre} | Parcelas: ${kpis.parcelas} | Eventos: ${kpis.eventos} | Superficie: ${superficieTotal} ha.`;

  return (
    <>
      <PageHeader
        title={zafra.nombre}
        description={`Reporte consolidado de la campaÃ±a. Cultivo principal: ${cultivoPrincipal?.nombre || "N/A"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions reportTitle={zafra.nombre} reportSummary={shareSummary} />
          <Button asChild>
            <Link href={`/eventos/crear?zafraId=${params.id}`}>Registrar Evento</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parcelas</CardTitle>
            <Sprout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.parcelas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Superficie Total</CardTitle>
            <Ruler className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superficieTotal} ha</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Eventos Totales</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.eventos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones</CardTitle>
            <SprayCan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.aplicaciones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ãšltima Actividad</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.ultimaActividad ? kpis.ultimaActividad.toLocaleDateString() : "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad por Tipo de Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={actividadPorTipo} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Cantidad" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Insumos MÃ¡s Usados</CardTitle>
            <CardDescription>Top 5 insumos por cantidad consumida en la zafra.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>CategorÃ­a</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insumosMasUsados?.map((insumo) => (
                  <TableRow key={insumo.nombre}>
                    <TableCell className="font-medium">{insumo.nombre}</TableCell>
                    <TableCell className="capitalize">{insumo.categoria}</TableCell>
                    <TableCell className="text-right">
                      {insumo.cantidad.toFixed(2)} {insumo.unidad}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen por Parcela</CardTitle>
          <CardDescription>Comparativa de las parcelas incluidas en esta zafra.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>HectÃ¡reas</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Aplicaciones</TableHead>
                <TableHead>Ãšltimo Evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelasEnZafra.map((parcela) => {
                const eventosParcela = eventos?.filter((evento) => evento.parcelaId === parcela.id) || [];
                const ultimoEvento = [...eventosParcela].sort(
                  (a, b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime()
                )[0];

                return (
                  <TableRow key={parcela.id}>
                    <TableCell className="font-medium">
                      <Link href={`/parcelas/${parcela.id}`} className="text-primary hover:underline">
                        {parcela.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>{parcela.superficie}</TableCell>
                    <TableCell>{eventosParcela.length}</TableCell>
                    <TableCell>{eventosParcela.filter((evento) => getTipoBaseFromEvento(evento.tipo) === "aplicacion").length}</TableCell>
                    <TableCell>{ultimoEvento ? new Date(ultimoEvento.fecha as string).toLocaleDateString() : "N/A"}</TableCell>
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

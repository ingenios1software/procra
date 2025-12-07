
"use client";

import { useMemo } from 'react';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Zafra, Parcela, Evento, Cultivo, Insumo } from '@/lib/types';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Ruler, Activity, CalendarDays, Sprout, SprayCan, Beaker, Bug, Tractor, Wheat } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function ZafraReportePage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();

  // --- Data Fetching ---
  const zafraRef = useMemoFirebase(() => firestore ? doc(firestore, 'zafras', params.id) : null, [firestore, params.id]);
  const { data: zafra, isLoading: l1 } = useDoc<Zafra>(zafraRef);

  const parcelasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]);
  const { data: todasParcelas, isLoading: l2 } = useCollection<Parcela>(parcelasQuery);

  const eventosQuery = useMemoFirebase(() => firestore && params.id ? query(collection(firestore, 'eventos'), where('zafraId', '==', params.id)) : null, [firestore, params.id]);
  const { data: eventos, isLoading: l3 } = useCollection<Evento>(eventosQuery);

  const cultivosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cultivos') : null, [firestore]);
  const { data: cultivos, isLoading: l4 } = useCollection<Cultivo>(cultivosQuery);

  const insumosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'insumos') : null, [firestore]);
  const { data: insumos, isLoading: l5 } = useCollection<Insumo>(insumosQuery);

  const isLoading = l1 || l2 || l3 || l4 || l5;
  
  // --- Data Processing ---
  const {
    parcelasEnZafra,
    cultivoPrincipal,
    superficieTotal,
    kpis,
    actividadPorTipo,
    insumosMasUsados
  } = useMemo(() => {
    if (!zafra || !todasParcelas || !eventos || !cultivos) {
      return { 
        parcelasEnZafra: [], 
        cultivoPrincipal: null,
        superficieTotal: 0,
        kpis: { parcelas: 0, superficie: 0, eventos: 0, aplicaciones: 0, fertilizaciones: 0, monitoreos: 0, labores: 0, cosechas: 0, ultimaActividad: null },
        actividadPorTipo: [],
        insumosMasUsados: []
      };
    }
    
    const idParcelasEnZafra = new Set(eventos.map(e => e.parcelaId));
    const parcelasEnZafra = todasParcelas.filter(p => idParcelasEnZafra.has(p.id));
    const superficieTotal = parcelasEnZafra.reduce((sum, p) => sum + p.superficie, 0);
    const cultivoPrincipal = cultivos.find(c => c.id === zafra.cultivoId);

    const eventosPorTipo = eventos.reduce((acc, ev) => {
        const tipo = ev.tipo || 'otros';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const ultimoEvento = eventos.sort((a,b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime())[0];

    const insumosConsumidos = eventos.flatMap(e => e.productos || []).reduce((acc, prod) => {
        const insumoNombre = insumos?.find(i => i.id === prod.insumoId)?.nombre || 'Desconocido';
        const unidad = insumos?.find(i => i.id === prod.insumoId)?.unidad || '';
        const categoria = insumos?.find(i => i.id === prod.insumoId)?.categoria || 'otros';
        
        if (!acc[insumoNombre]) {
            acc[insumoNombre] = { cantidad: 0, unidad, categoria };
        }
        acc[insumoNombre].cantidad += prod.cantidad || 0;
        return acc;
    }, {} as Record<string, { cantidad: number, unidad: string, categoria: string }>);

    const insumosMasUsados = Object.entries(insumosConsumidos)
        .map(([nombre, data]) => ({ nombre, ...data }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

    const kpis = {
      parcelas: parcelasEnZafra.length,
      superficie: superficieTotal,
      eventos: eventos.length,
      aplicaciones: eventosPorTipo['aplicacion'] || 0,
      fertilizaciones: eventosPorTipo['fertilización'] || 0,
      monitoreos: eventosPorTipo['monitoreo'] || 0,
      labores: eventosPorTipo['mantenimiento'] || 0,
      cosechas: eventosPorTipo['cosecha'] || 0,
      ultimaActividad: ultimoEvento ? new Date(ultimoEvento.fecha as string) : null,
    };
    
    return {
      parcelasEnZafra,
      cultivoPrincipal,
      superficieTotal,
      kpis,
      actividadPorTipo: Object.entries(eventosPorTipo).map(([name, value]) => ({ name, Cantidad: value })),
      insumosMasUsados,
    };
  }, [zafra, todasParcelas, eventos, cultivos, insumos]);

  if (isLoading) {
    return <p>Cargando reporte de zafra...</p>;
  }

  if (!zafra) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={zafra.nombre}
        description={`Reporte consolidado de la campaña. Cultivo principal: ${cultivoPrincipal?.nombre || 'N/A'}`}
      >
        <Button asChild><Link href={`/eventos/crear?zafraId=${params.id}`}>Registrar Evento</Link></Button>
      </PageHeader>

      {/* Section 1: KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Parcelas</CardTitle><Sprout className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.parcelas}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Superficie Total</CardTitle><Ruler className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{superficieTotal} ha</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Eventos Totales</CardTitle><Activity className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.eventos}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Aplicaciones</CardTitle><SprayCan className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.aplicaciones}</div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Última Actividad</CardTitle><CalendarDays className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.ultimaActividad ? kpis.ultimaActividad.toLocaleDateString() : 'N/A'}</div></CardContent></Card>
      </div>

      {/* Section 2 & 3: Charts */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
              <CardHeader><CardTitle>Actividad por Tipo de Evento</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>Insumos Más Usados</CardTitle><CardDescription>Top 5 insumos por cantidad consumida en la zafra.</CardDescription></CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Cantidad</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {insumosMasUsados?.map(insumo => (
                              <TableRow key={insumo.nombre}>
                                  <TableCell className="font-medium">{insumo.nombre}</TableCell>
                                  <TableCell className="capitalize">{insumo.categoria}</TableCell>
                                  <TableCell className="text-right">{insumo.cantidad.toFixed(2)} {insumo.unidad}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      </div>

      {/* Section 4: Parcelas */}
      <Card>
          <CardHeader><CardTitle>Resumen por Parcela</CardTitle><CardDescription>Comparativa de las parcelas incluidas en esta zafra.</CardDescription></CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Hectáreas</TableHead>
                          <TableHead>Eventos</TableHead>
                          <TableHead>Aplicaciones</TableHead>
                          <TableHead>Último Evento</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {parcelasEnZafra.map(parcela => {
                          const eventosParcela = eventos?.filter(e => e.parcelaId === parcela.id) || [];
                          const ultimoEvento = eventosParcela.sort((a,b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime())[0];
                          return (
                              <TableRow key={parcela.id}>
                                  <TableCell className="font-medium"><Link href={`/parcelas/${parcela.id}`} className="text-primary hover:underline">{parcela.nombre}</Link></TableCell>
                                  <TableCell>{parcela.superficie}</TableCell>
                                  <TableCell>{eventosParcela.length}</TableCell>
                                  <TableCell>{eventosParcela.filter(e => e.tipo === 'aplicacion').length}</TableCell>
                                  <TableCell>{ultimoEvento ? new Date(ultimoEvento.fecha as string).toLocaleDateString() : 'N/A'}</TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>
    </>
  );
}

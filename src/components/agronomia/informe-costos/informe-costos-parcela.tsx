"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, Venta } from "@/lib/types";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";

interface InformeCostosParcelaProps {
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  eventos: Evento[];
  insumos: Insumo[];
  ventas: Venta[];
  isLoading: boolean;
}

interface CostoParcelaData {
    parcela: Parcela;
    cultivo?: Cultivo;
    zafra?: Zafra;
    costoTotal: number;
    costoHa: number;
    rendimiento: number;
    costoPorTn: number;
    costoProductos: number;
    costoServicios: number;
    eventos: number;
}

export function InformeCostosParcela({ parcelas, cultivos, zafras, eventos, insumos, ventas, isLoading }: InformeCostosParcelaProps) {
  const [selectedCultivoId, setSelectedCultivoId] = useState<string | null>(null);
  const [selectedZafraId, setSelectedZafraId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const zafrasFiltradas = useMemo(() => {
    return selectedCultivoId
      ? zafras.filter((z) => z.cultivoId === selectedCultivoId)
      : zafras;
  }, [selectedCultivoId, zafras]);

  const data = useMemo<CostoParcelaData[]>(() => {
    const parcelasActivas = selectedZafraId
        ? parcelas.filter(p => eventos.some(e => e.parcelaId === p.id && e.zafraId === selectedZafraId))
        : parcelas;

    return parcelasActivas.map(parcela => {
        const eventosParcela = eventos.filter(e => e.parcelaId === parcela.id && (!selectedZafraId || e.zafraId === selectedZafraId));
        const zafra = zafras.find(z => z.id === selectedZafraId);
        const cultivo = cultivos.find(c => c.id === zafra?.cultivoId);
        
        const costoTotal = eventosParcela.reduce((sum, ev) => sum + (ev.costoTotal || 0), 0);
        const costoHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;

        const costoProductos = eventosParcela.reduce((sum, ev) => {
            const costoServicio = (ev.costoServicioPorHa || 0) * (ev.hectareasAplicadas || 0);
            return sum + ((ev.costoTotal || 0) - costoServicio);
        }, 0);

        const costoServicios = eventosParcela.reduce((sum, ev) => sum + ((ev.costoServicioPorHa || 0) * (ev.hectareasAplicadas || 0)), 0);

        const ventasParcela = ventas.filter(v => v.parcelaId === parcela.id && (!selectedZafraId || v.zafraId === selectedZafraId));
        const totalKg = ventasParcela.reduce((sum, v) => sum + (v.toneladas * 1000), 0);
        const rendimiento = parcela.superficie > 0 ? totalKg / parcela.superficie : 0;
        const costoPorTn = rendimiento > 0 ? costoHa / (rendimiento/1000) : 0;
        
        return {
            parcela,
            cultivo,
            zafra,
            costoTotal,
            costoHa,
            rendimiento,
            costoPorTn,
            costoProductos,
            costoServicios,
            eventos: eventosParcela.length
        }
    }).filter(item => item.costoTotal > 0);
  }, [parcelas, cultivos, zafras, eventos, ventas, selectedZafraId]);

   const columns: ColumnDef<CostoParcelaData>[] = [
    { accessorKey: "parcela.nombre", header: "Parcela" },
    { accessorKey: "parcela.superficie", header: "Superficie (ha)", cell: ({ getValue }) => <div className="text-right">{getValue<number>().toFixed(2)}</div> },
    { accessorKey: "costoTotal", header: "Costo Total ($)", cell: ({ getValue }) => <div className="text-right font-semibold">${getValue<number>().toLocaleString('es-AR', {minimumFractionDigits: 2})}</div> },
    { accessorKey: "costoHa", header: "Costo/ha ($)", cell: ({ getValue }) => <div className="text-right font-semibold">${getValue<number>().toLocaleString('es-AR', {minimumFractionDigits: 2})}</div> },
    { accessorKey: "rendimiento", header: "Rendimiento (kg/ha)", cell: ({ getValue }) => <div className="text-right">{getValue<number>().toLocaleString('es-AR', {minimumFractionDigits: 2})}</div> },
    { accessorKey: "costoPorTn", header: "Costo/tn ($)", cell: ({ getValue }) => <div className="text-right text-primary font-bold">${getValue<number>().toLocaleString('es-AR', {minimumFractionDigits: 2})}</div> },
    { accessorKey: "eventos", header: "N° Eventos", cell: ({ getValue }) => <div className="text-center">{getValue<number>()}</div> },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <PageHeader
        title="Informe de Costos por Parcela"
        description="Análisis comparativo de costos, eficiencia y rendimiento entre parcelas."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Seleccione un cultivo y una zafra para acotar el análisis.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Select onValueChange={(v) => setSelectedCultivoId(v === "all" ? null : v)} value={selectedCultivoId || ''}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filtrar por Cultivo..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Cultivos</SelectItem>
              {cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => setSelectedZafraId(v === "all" ? null : v)} value={selectedZafraId || ''} disabled={!selectedCultivoId}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filtrar por Zafra..." /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas las Zafras</SelectItem>
                {zafrasFiltradas.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className="cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
            {isLoading && <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Cargando datos...</TableCell></TableRow>}
            {!isLoading && table.getRowModel().rows.length === 0 && <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

       <div className="grid md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader><CardTitle>Eficiencia: Costo/ha vs Rendimiento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="parcela.nombre" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Costo/ha ($)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Rendimiento (kg/ha)', angle: 90, position: 'insideRight' }}/>
                <Tooltip formatter={(value, name) => [typeof value === 'number' ? value.toLocaleString('es-AR', {maximumFractionDigits: 2}) : value, name]}/>
                <Legend />
                <Bar yAxisId="left" dataKey="costoHa" name="Costo/ha" fill="#8884d8" />
                <Line yAxisId="right" type="monotone" dataKey="rendimiento" name="Rendimiento" stroke="#82ca9d" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Composición de Costos</CardTitle></CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical" stackOffset="expand">
                        <XAxis type="number" hide domain={[0, 1]} tickFormatter={(value) => `${value * 100}%`} />
                        <YAxis type="category" dataKey="parcela.nombre" />
                        <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(2)}%`}/>
                        <Legend />
                        <Bar dataKey="costoProductos" name="Insumos" stackId="a" fill="hsl(var(--chart-1))" />
                        <Bar dataKey="costoServicios" name="Servicios" stackId="a" fill="hsl(var(--chart-2))" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>
    </>
  );
}

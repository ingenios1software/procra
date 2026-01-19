
"use client";

import { useState, useMemo } from 'react';
import { notFound } from "next/navigation";
import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { Insumo, MovimientoStock, Zafra, Parcela } from '@/lib/types';
import { type DateRange } from "react-day-picker";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Package, DollarSign, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MovimientoConSaldo extends MovimientoStock {
  saldoAcumulado: number;
}

export default function FichaInsumoPage({ params }: { params: { insumoId: string } }) {
  const firestore = useFirestore();

  // --- State for Filters ---
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedZafra, setSelectedZafra] = useState<string>('all');
  const [selectedTipos, setSelectedTipos] = useState<string[]>(['entrada', 'salida', 'ajuste']);

  // --- Data Fetching ---
  const insumoRef = useMemoFirebase(() => firestore ? doc(firestore, 'insumos', params.insumoId) : null, [firestore, params.insumoId]);
  const { data: insumo, isLoading: isLoadingInsumo } = useDoc<Insumo>(insumoRef);

  const movimientosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let q = query(collection(firestore, 'movimientosStock'), where('insumoId', '==', params.insumoId), orderBy('fecha', 'asc'));
    return q;
  }, [firestore, params.insumoId]);

  const { data: movimientos, isLoading: isLoadingMovimientos } = useCollection<MovimientoStock>(movimientosQuery);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]));
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]));
  
  const isLoading = isLoadingInsumo || isLoadingMovimientos || isLoadingZafras || isLoadingParcelas;
  
  // --- Data Processing & Filtering ---
  const { movimientosFiltrados, totales } = useMemo(() => {
    if (!movimientos) return { movimientosFiltrados: [], totales: { entradas: 0, salidas: 0 } };

    const filtered = movimientos.filter(mov => {
      const movDate = new Date(mov.fecha as any);
      const isAfterFrom = !dateRange?.from || movDate >= dateRange.from;
      const isBeforeTo = !dateRange?.to || movDate <= dateRange.to;
      const zafraMatch = selectedZafra === 'all' || mov.zafraId === selectedZafra;
      const tipoMatch = selectedTipos.includes(mov.tipo);
      return isAfterFrom && isBeforeTo && zafraMatch && tipoMatch;
    });

    let saldoAcumulado = 0;
    let totalEntradas = 0;
    let totalSalidas = 0;

    const conSaldo: MovimientoConSaldo[] = filtered.map(mov => {
      const cantidad = mov.cantidad || 0;
      if (mov.tipo === 'entrada') {
        saldoAcumulado += cantidad;
        totalEntradas += cantidad;
      } else if (mov.tipo === 'salida') {
        saldoAcumulado -= cantidad;
        totalSalidas += cantidad;
      }
      return { ...mov, saldoAcumulado };
    });

    return { 
      movimientosFiltrados: conSaldo, 
      totales: { entradas: totalEntradas, salidas: totalSalidas }
    };
  }, [movimientos, dateRange, selectedZafra, selectedTipos]);
  
  const getZafraNombre = (id?: string | null) => id ? (zafras?.find(z => z.id === id)?.nombre || 'N/A') : 'N/A';
  const getParcelaNombre = (id?: string | null) => id ? (parcelas?.find(p => p.id === id)?.nombre || 'N/A') : 'N/A';
  
  const handleTipoChange = (tipo: string, checked: boolean) => {
    setSelectedTipos(prev => 
      checked ? [...prev, tipo] : prev.filter(t => t !== tipo)
    );
  };
  
  if (isLoading) return <p>Cargando ficha del insumo...</p>;
  if (!insumo) return notFound();

  const valorEnStock = (insumo.stockActual || 0) * (insumo.precioPromedioCalculado || 0);

  return (
    <>
      <PageHeader title="Ficha de Insumo" description={`Historial de movimientos para ${insumo.nombre}`} />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package/> {insumo.nombre} (#{insumo.numeroItem})</CardTitle>
          <CardDescription>
            <Badge variant="outline" className="mr-2 capitalize">{insumo.categoria}</Badge>
            <Badge variant="secondary">{insumo.unidad}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-xs text-muted-foreground">Stock Actual</p>
                  <p className="text-lg font-bold">{insumo.stockActual.toLocaleString('de-DE')} {insumo.unidad}</p>
              </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-xs text-muted-foreground">Precio Promedio</p>
                  <p className="text-lg font-bold">${insumo.precioPromedioCalculado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
              </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-xs text-muted-foreground">Valor en Stock</p>
                  <p className="text-lg font-bold">${valorEnStock.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
              </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
          <CardHeader>
              <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[300px] justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Seleccionar período</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
              <Select onValueChange={setSelectedZafra} value={selectedZafra}>
                  <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Filtrar por Zafra..." />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todas las Zafras</SelectItem>
                      {zafras?.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                  </SelectContent>
              </Select>
              <div className="flex items-center space-x-4">
                  {['entrada', 'salida', 'ajuste'].map(tipo => (
                      <div key={tipo} className="flex items-center space-x-2">
                          <Checkbox id={tipo} checked={selectedTipos.includes(tipo)} onCheckedChange={(checked) => handleTipoChange(tipo, !!checked)} />
                          <label htmlFor={tipo} className="text-sm font-medium leading-none capitalize">{tipo}</label>
                      </div>
                  ))}
              </div>
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Historial de Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Zafra/Parcela</TableHead>
                        <TableHead className="text-right">Entrada</TableHead>
                        <TableHead className="text-right">Salida</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {movimientosFiltrados.map(mov => (
                        <TableRow key={mov.id}>
                            <TableCell>{format(new Date(mov.fecha as any), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className='capitalize'>{mov.tipo}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="capitalize font-medium">{mov.origen}</span>
                                    <span className="text-xs text-muted-foreground">{mov.documentoOrigen}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span>{getZafraNombre(mov.zafraId)}</span>
                                    <span className="text-xs text-muted-foreground">{getParcelaNombre(mov.parcelaId)}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">{mov.tipo === 'entrada' ? mov.cantidad.toLocaleString('de-DE') : '-'}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{mov.tipo === 'salida' ? mov.cantidad.toLocaleString('de-DE') : '-'}</TableCell>
                            <TableCell className="text-right font-mono">${(mov.precioUnitario || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right font-mono">${(mov.costoTotal || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right font-mono font-bold">${(mov.saldoAcumulado || 0).toLocaleString('de-DE')}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold text-base">
                        <TableCell colSpan={4}>Totales del Período</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{totales.entradas.toLocaleString('de-DE')}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{totales.salidas.toLocaleString('de-DE')}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="text-right font-mono">${(movimientosFiltrados[movimientosFiltrados.length - 1]?.saldoAcumulado || 0).toLocaleString('de-DE')}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </CardContent>
      </Card>
    </>
  );
}

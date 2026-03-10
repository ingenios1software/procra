
"use client";

import { useState, useMemo } from 'react';
import { notFound } from "next/navigation";
import { useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { where } from 'firebase/firestore';
import type { Insumo, MovimientoStock, Zafra, Parcela, CompraNormal } from '@/lib/types';
import { type DateRange } from "react-day-picker";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, DollarSign, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { calcularPrecioPromedioDesdeCompras, toPositiveNumber } from "@/lib/stock/precio-promedio-lotes";
import { FirestorePermissionError } from '@/firebase/errors';
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

interface MovimientoConSaldo extends MovimientoStock {
  saldoAcumulado: number;
}

function getMovimientoDelta(mov: MovimientoStock): number {
  const cantidad = Number(mov.cantidad) || 0;

  if (mov.tipo === 'entrada') return cantidad;
  if (mov.tipo === 'salida') return -cantidad;

  const stockAntes = Number((mov as { stockAntes?: number }).stockAntes);
  const stockDespues = Number((mov as { stockDespues?: number }).stockDespues);
  if (Number.isFinite(stockAntes) && Number.isFinite(stockDespues)) {
    return stockDespues - stockAntes;
  }

  return cantidad;
}

function toDateSafe(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };

    if (typeof maybeTimestamp.toDate === 'function') {
      const parsed = maybeTimestamp.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      const parsed = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function formatMovimientoFecha(value: unknown): string {
  const parsed = toDateSafe(value);
  return parsed ? format(parsed, 'dd/MM/yyyy') : 'Sin fecha';
}

function dateToInputValue(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  return format(value, 'yyyy-MM-dd');
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default function FichaInsumoPage({ params }: { params: { insumoId: string } }) {
  const tenant = useTenantFirestore();

  // --- State for Filters ---
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedZafra, setSelectedZafra] = useState<string>('all');
  const [selectedTipos, setSelectedTipos] = useState<string[]>(['entrada', 'salida', 'ajuste']);

  // --- Data Fetching ---
  const insumoRef = useMemoFirebase(() => tenant.doc('insumos', params.insumoId), [tenant, params.insumoId]);
  const { data: insumo, isLoading: isLoadingInsumo } = useDoc<Insumo>(insumoRef);

  const movimientosQuery = useMemoFirebase(() => {
    return tenant.query('MovimientosStock', where('insumoId', '==', params.insumoId));
  }, [tenant, params.insumoId]);

  const { data: movimientos, isLoading: isLoadingMovimientos, error: movimientosError } = useCollection<MovimientoStock>(movimientosQuery);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(useMemoFirebase(() => tenant.collection('zafras'), [tenant]));
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(useMemoFirebase(() => tenant.collection('parcelas'), [tenant]));
  const { data: comprasNormal, isLoading: isLoadingCompras } = useCollection<CompraNormal>(
    useMemoFirebase(() => tenant.collection('comprasNormal'), [tenant])
  );
  
  const isLoading = isLoadingInsumo || isLoadingMovimientos || isLoadingZafras || isLoadingParcelas || isLoadingCompras;
  
  // --- Data Processing & Filtering ---
  const { movimientosFiltrados, totales, saldoHistoricoTotal } = useMemo(() => {
    if (!movimientos) {
      return { movimientosFiltrados: [], totales: { entradas: 0, salidas: 0 }, saldoHistoricoTotal: 0 };
    }

    const movimientosOrdenados = [...movimientos].sort((a, b) => {
      const safeATime = toDateSafe(a.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const safeBTime = toDateSafe(b.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return safeATime - safeBTime;
    });

    const saldoHistoricoTotal = movimientosOrdenados.reduce((acc, mov) => acc + getMovimientoDelta(mov), 0);

    const filtered = movimientosOrdenados
      .filter(mov => {
        const movDate = toDateSafe(mov.fecha);
        const isAfterFrom = !dateRange?.from || (!!movDate && movDate >= dateRange.from);
        const isBeforeTo = !dateRange?.to || (!!movDate && movDate <= dateRange.to);
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
      } else if (mov.tipo === 'ajuste') {
        saldoAcumulado += getMovimientoDelta(mov);
      }
      return { ...mov, saldoAcumulado };
    });

    return { 
      movimientosFiltrados: conSaldo, 
      totales: { entradas: totalEntradas, salidas: totalSalidas },
      saldoHistoricoTotal,
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

  const precioPromedioActual =
    calcularPrecioPromedioDesdeCompras(insumo.id, comprasNormal || []) ??
    toPositiveNumber(insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
  const valorEnStock = (insumo.stockActual || 0) * precioPromedioActual;
  const diferenciaStockVsHistorial = (Number(insumo.stockActual) || 0) - saldoHistoricoTotal;
  const hayDiferenciaStockVsHistorial = Math.abs(diferenciaStockVsHistorial) > 0.0001;
  const movimientosErrorCode = (movimientosError as { code?: string } | null)?.code;
  const movimientosErrorMessage = !movimientosError
    ? null
    : movimientosError instanceof FirestorePermissionError
      ? 'No tienes permisos para leer movimientos de stock en esta base de datos.'
      : movimientosErrorCode === 'failed-precondition'
        ? 'No se pudo cargar el historial porque falta un índice de Firestore para esta consulta.'
        : 'No se pudieron cargar los movimientos de stock por un error de lectura en la base de datos.';

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
                  <p className="text-lg font-bold">${precioPromedioActual.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-xs text-muted-foreground">Valor en Stock</p>
                  <p className="text-lg font-bold">${valorEnStock.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
          <CardHeader>
              <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex w-full md:w-auto gap-2">
                <Input
                  type="date" lang="es-PY"
                  className="w-full md:w-[170px]"
                  value={dateToInputValue(dateRange?.from)}
                  onChange={(e) => {
                    const from = inputValueToDate(e.target.value);
                    setDateRange((prev) => ({
                      from,
                      to: prev?.to,
                    }));
                  }}
                />
                <Input
                  type="date" lang="es-PY"
                  className="w-full md:w-[170px]"
                  value={dateToInputValue(dateRange?.to)}
                  onChange={(e) => {
                    const to = inputValueToDate(e.target.value);
                    setDateRange((prev) => ({
                      from: prev?.from,
                      to,
                    }));
                  }}
                />
              </div>
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
            <CardDescription>
              El saldo mostrado corresponde a los movimientos visibles segun los filtros aplicados.
            </CardDescription>
            {!movimientosErrorMessage && hayDiferenciaStockVsHistorial && (
              <CardDescription className="text-amber-700">
                Diferencia detectada vs stock actual: {diferenciaStockVsHistorial > 0 ? '+' : ''}{diferenciaStockVsHistorial.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {insumo.unidad}. Esto suele ocurrir por saldo inicial/importacion o ajustes sin trazabilidad completa.
              </CardDescription>
            )}
            {movimientosErrorMessage && (
              <CardDescription className="text-destructive">
                {movimientosErrorMessage}
              </CardDescription>
            )}
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
                        <TableHead className="text-right">Saldo filtrado ({insumo.unidad})</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {movimientosFiltrados.map(mov => (
                        <TableRow key={mov.id}>
                            <TableCell>{formatMovimientoFecha(mov.fecha)}</TableCell>
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
                            <TableCell className="text-right font-mono">${(mov.precioUnitario || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right font-mono">${(mov.costoTotal || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{(mov.saldoAcumulado || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold text-base">
                        <TableCell colSpan={4}>Totales del Periodo (segun filtros)</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{totales.entradas.toLocaleString('de-DE')}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{totales.salidas.toLocaleString('de-DE')}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="text-right font-mono">{(movimientosFiltrados[movimientosFiltrados.length - 1]?.saldoAcumulado || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </CardContent>
      </Card>
    </>
  );
}






"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Parcela, Zafra, Evento, Insumo } from "@/lib/types";
import { format, differenceInDays } from "date-fns";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";
import { getEventDate, getSowingBaseDate } from "./panel-evento-utils";
import { getEventTypeDisplay } from "@/lib/eventos/tipos";

interface PanelTablaAgronomicaProps {
    parcela: Parcela;
    zafra: Zafra;
    eventos: Evento[];
    insumos: Insumo[];
}

type ProductoEvento = {
  insumoId?: string;
  cantidad?: number;
  dosis?: number;
};

const getRowColor = (categoria?: string) => {
    switch(categoria) {
        case 'Desecación': return 'bg-yellow-100/50 hover:bg-yellow-100/80 dark:bg-yellow-900/20';
        case 'Siembra': return 'bg-green-100/50 hover:bg-green-100/80 dark:bg-green-900/20';
        case 'Fertilizante': return 'bg-gray-100/50 hover:bg-gray-100/80 dark:bg-gray-800/20';
        case 'Insecticida': return 'bg-red-100/50 hover:bg-red-100/80 dark:bg-red-900/20';
        case 'Fungicida': return 'bg-orange-100/50 hover:bg-orange-100/80 dark:bg-orange-900/20';
        default: return '';
    }
}

const normalizeTipo = (value?: string) =>
  (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function getProductoMetrics(
  producto: ProductoEvento,
  insumo: Insumo | undefined,
  evento: Evento,
  superficieParcela: number
) {
  const precioUnitario = Number(insumo?.precioPromedioCalculado ?? insumo?.costoUnitario ?? 0) || 0;
  const dosisHa = Number(producto?.dosis ?? 0) || 0;
  const cantidadDirecta = Number(producto?.cantidad ?? 0) || 0;
  const hectareasEvento = Number(evento.hectareasAplicadas ?? 0) || 0;
  const baseHa = hectareasEvento > 0 ? hectareasEvento : Math.max(0, Number(superficieParcela) || 0);
  const cantidadTotal =
    cantidadDirecta > 0 ? cantidadDirecta : dosisHa > 0 && baseHa > 0 ? dosisHa * baseHa : 0;
  const costoProducto = Math.max(0, cantidadTotal * precioUnitario);
  const costoPorHa = baseHa > 0 ? costoProducto / baseHa : 0;

  return { precioUnitario, dosisHa, cantidadTotal, costoProducto, costoPorHa };
}

export function PanelTablaAgronomica({ parcela, zafra, eventos, insumos }: PanelTablaAgronomicaProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showProducts, setShowProducts] = useState(true);

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    }
    
    const fechaSiembraEvento = eventos.reduce<Date | null>((acumulado, evento) => {
      if (!normalizeTipo(evento.tipo).includes("siembra")) return acumulado;
      const fechaEvento = getEventDate(evento);
      if (!fechaEvento) return acumulado;
      if (!acumulado) return fechaEvento;
      return fechaEvento.getTime() < acumulado.getTime() ? fechaEvento : acumulado;
    }, null);

    const fechaSiembraBase = fechaSiembraEvento || getSowingBaseDate(zafra, eventos);
    let costoTotalGeneral = 0;

    const getEventoRef = (evento: Evento): string | null => {
        if (evento.numeroLanzamiento !== undefined && evento.numeroLanzamiento !== null) {
            return `N° ${evento.numeroLanzamiento}`;
        }
        if (evento.numeroItem !== undefined && evento.numeroItem !== null) {
            return `Item ${evento.numeroItem}`;
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Informe Agronómico Detallado</CardTitle>
                        <CardDescription>Análisis cronológico de todos los eventos y costos de la campaña.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowProducts(!showProducts)}>
                        {showProducts ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
                        {showProducts ? 'Ocultar Productos' : 'Mostrar Productos'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Fecha / Evento</TableHead>
                                <TableHead>Tipo Evento</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Dosis/Ha</TableHead>
                                <TableHead className="text-right">Cant. Total</TableHead>
                                <TableHead className="text-right">Precio Unit.</TableHead>
                                <TableHead className="text-right">Costo Prod.</TableHead>
                                <TableHead className="text-right">Días Entre Ev.</TableHead>
                                <TableHead className="text-right">Ciclo Evento</TableHead>
                                <TableHead className="text-right">Costo/Ha</TableHead>
                                <TableHead className="text-right">Costo Evento</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {eventos.map((evento, index) => {
                                const isExpanded = expandedRows.has(evento.id);
                                const fechaEventoActual = getEventDate(evento);
                                const fechaEventoAnterior = index > 0 ? getEventDate(eventos[index - 1]) : null;
                                const diasEntreEventos =
                                  fechaEventoActual && fechaEventoAnterior
                                    ? Math.max(0, differenceInDays(fechaEventoActual, fechaEventoAnterior))
                                    : 0;
                                const cicloEvento = fechaEventoActual
                                  ? Math.max(0, differenceInDays(fechaEventoActual, fechaSiembraBase))
                                  : 0;
                                const costoPorHa = parcela.superficie > 0 ? (evento.costoTotal || 0) / parcela.superficie : 0;
                                const eventoRef = getEventoRef(evento);
                                costoTotalGeneral += evento.costoTotal || 0;

                                const productosDelEvento: ProductoEvento[] =
                                  evento.productos || (evento.insumoId ? [{ insumoId: evento.insumoId, cantidad: evento.cantidad, dosis: evento.dosis }] : []);
                                
                                return (
                                    <React.Fragment key={evento.id}>
                                        <TableRow className={cn("font-semibold cursor-pointer", getRowColor(evento.categoria))} onClick={() => toggleRow(evento.id)}>
                                            <TableCell><Button variant="ghost" size="icon" className="h-6 w-6">{isExpanded ? <ChevronDown /> : <ChevronRight />}</Button></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span>{fechaEventoActual ? format(fechaEventoActual, 'dd/MM/yy') : "N/A"}</span>
                                                    {eventoRef && (
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            ({eventoRef})
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{evento.categoria || getEventTypeDisplay(evento)}</TableCell>
                                            <TableCell>{productosDelEvento.length} Producto(s)</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{diasEntreEventos}</TableCell>
                                            <TableCell className="text-right">{cicloEvento}</TableCell>
                                            <TableCell className="text-right">${costoPorHa.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold">${(evento.costoTotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                        {isExpanded && showProducts && productosDelEvento.map((prod, prodIndex) => {
                                            const insumo = insumos.find(i => i.id === prod.insumoId);
                                            const metrics = getProductoMetrics(prod, insumo, evento, parcela.superficie);

                                            return (
                                                <TableRow key={`${evento.id}-${prodIndex}`} className="bg-muted/10 hover:bg-muted/30">
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8 text-sm">{insumo?.nombre || 'N/A'}</TableCell>
                                                    <TableCell className="text-right text-sm">
                                                      {metrics.dosisHa > 0
                                                        ? `${metrics.dosisHa.toFixed(2)} ${insumo?.unidad || ""}/ha`
                                                        : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                      {metrics.cantidadTotal > 0
                                                        ? `${metrics.cantidadTotal.toFixed(2)} ${insumo?.unidad || ""}`
                                                        : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                      ${metrics.precioUnitario.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                      ${metrics.costoProducto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="text-right text-sm">
                                                      ${metrics.costoPorHa.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </React.Fragment>
                                )
                            })}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-lg bg-primary/10">
                                <TableCell colSpan={11}>Costo Total Acumulado</TableCell>
                                <TableCell className="text-right">${costoTotalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}


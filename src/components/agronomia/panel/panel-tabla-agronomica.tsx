"use client";

import { useMemo, useState } from "react";
import React from "react";
import { format, differenceInDays } from "date-fns";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getEventTypeDisplay } from "@/lib/eventos/tipos";
import type { Evento, Insumo, Parcela, Zafra } from "@/lib/types";
import { getEventDate, getSowingBaseDate } from "./panel-evento-utils";

interface PanelTablaAgronomicaProps {
  parcelas: Parcela[];
  zafra: Zafra;
  eventos: Evento[];
  insumos: Insumo[];
}

type ProductoEvento = {
  insumoId?: string;
  cantidad?: number;
  dosis?: number;
};

type EventRow = {
  evento: Evento;
  parcela?: Parcela;
  fechaEventoActual: Date | null;
  diasEntreEventos: number;
  cicloEvento: number;
  hectareasEvento: number;
  costoPorHa: number;
  superficieParcela: number;
  productosDelEvento: ProductoEvento[];
};

const formatHectareas = (value?: number | null) => {
  const hectareas = Number(value ?? 0) || 0;
  if (hectareas <= 0) return "-";

  return hectareas.toLocaleString("de-DE", {
    minimumFractionDigits: hectareas % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const getRowColor = (categoria?: string) => {
  switch (categoria) {
    case "Desecacion":
    case "Desecaci\u00f3n":
      return "bg-yellow-100/50 hover:bg-yellow-100/80 dark:bg-yellow-900/20";
    case "Siembra":
      return "bg-green-100/50 hover:bg-green-100/80 dark:bg-green-900/20";
    case "Fertilizante":
      return "bg-gray-100/50 hover:bg-gray-100/80 dark:bg-gray-800/20";
    case "Insecticida":
      return "bg-red-100/50 hover:bg-red-100/80 dark:bg-red-900/20";
    case "Fungicida":
      return "bg-orange-100/50 hover:bg-orange-100/80 dark:bg-orange-900/20";
    default:
      return "";
  }
};

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

function getEventoRef(evento: Evento): string | null {
  if (evento.numeroLanzamiento !== undefined && evento.numeroLanzamiento !== null) {
    return `N° ${evento.numeroLanzamiento}`;
  }
  if (evento.numeroItem !== undefined && evento.numeroItem !== null) {
    return `Item ${evento.numeroItem}`;
  }
  return null;
}

export function PanelTablaAgronomica({ parcelas, zafra, eventos, insumos }: PanelTablaAgronomicaProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showProducts, setShowProducts] = useState(true);
  const showParcelaColumn = parcelas.length > 1;

  const parcelasById = useMemo(
    () => new Map(parcelas.map((parcela) => [parcela.id, parcela])),
    [parcelas]
  );
  const insumosById = useMemo(
    () => new Map(insumos.map((insumo) => [insumo.id, insumo])),
    [insumos]
  );

  const fechaSiembraBaseByParcela = useMemo(() => {
    const eventosPorParcela = new Map<string, Evento[]>();

    eventos.forEach((evento) => {
      const current = eventosPorParcela.get(evento.parcelaId) || [];
      current.push(evento);
      eventosPorParcela.set(evento.parcelaId, current);
    });

    const fechas = new Map<string, Date>();
    eventosPorParcela.forEach((eventosParcela, parcelaId) => {
      fechas.set(parcelaId, getSowingBaseDate(zafra, eventosParcela));
    });

    return fechas;
  }, [eventos, zafra]);

  const rows = useMemo(() => {
    const previousDateByParcela = new Map<string, Date>();

    return eventos.map((evento) => {
      const fechaEventoActual = getEventDate(evento);
      const fechaEventoAnterior = previousDateByParcela.get(evento.parcelaId) || null;
      const diasEntreEventos =
        fechaEventoActual && fechaEventoAnterior
          ? Math.max(0, differenceInDays(fechaEventoActual, fechaEventoAnterior))
          : 0;

      if (fechaEventoActual) {
        previousDateByParcela.set(evento.parcelaId, fechaEventoActual);
      }

      const fechaSiembraBase =
        fechaSiembraBaseByParcela.get(evento.parcelaId) || getSowingBaseDate(zafra, [evento]);
      const cicloEvento = fechaEventoActual
        ? Math.max(0, differenceInDays(fechaEventoActual, fechaSiembraBase))
        : 0;
      const parcela = parcelasById.get(evento.parcelaId);
      const superficieParcela = Number(parcela?.superficie ?? 0) || 0;
      const hectareasEvento = Number(evento.hectareasAplicadas ?? 0) || 0;
      const costoPorHa = superficieParcela > 0 ? (evento.costoTotal || 0) / superficieParcela : 0;
      const productosDelEvento: ProductoEvento[] =
        evento.productos ||
        (evento.insumoId ? [{ insumoId: evento.insumoId, cantidad: evento.cantidad, dosis: evento.dosis }] : []);

      return {
        evento,
        parcela,
        fechaEventoActual,
        diasEntreEventos,
        cicloEvento,
        hectareasEvento,
        costoPorHa,
        superficieParcela,
        productosDelEvento,
      } satisfies EventRow;
    });
  }, [eventos, fechaSiembraBaseByParcela, parcelasById, zafra]);

  const costoTotalGeneral = useMemo(
    () => rows.reduce((total, row) => total + (row.evento.costoTotal || 0), 0),
    [rows]
  );

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Informe Agronomico Detallado</CardTitle>
            <CardDescription>Analisis cronologico de todos los eventos y costos de la campana.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowProducts(!showProducts)}>
            {showProducts ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
            {showProducts ? "Ocultar Productos" : "Mostrar Productos"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table resizable>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Fecha / Evento</TableHead>
                {showParcelaColumn ? <TableHead>Parcela</TableHead> : null}
                <TableHead>Tipo Evento</TableHead>
                <TableHead className="text-right">Ha Evento</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Dosis/Ha</TableHead>
                <TableHead className="text-right">Cant. Total</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Costo Prod.</TableHead>
                <TableHead className="text-right">Dias Entre Ev.</TableHead>
                <TableHead className="text-right">Ciclo Evento</TableHead>
                <TableHead className="text-right">Costo/Ha</TableHead>
                <TableHead className="text-right">Costo Evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const {
                  evento,
                  parcela,
                  fechaEventoActual,
                  diasEntreEventos,
                  cicloEvento,
                  hectareasEvento,
                  costoPorHa,
                  superficieParcela,
                  productosDelEvento,
                } = row;
                const isExpanded = expandedRows.has(evento.id);
                const eventoRef = getEventoRef(evento);

                return (
                  <React.Fragment key={evento.id}>
                    <TableRow
                      className={cn("cursor-pointer font-semibold", getRowColor(evento.categoria))}
                      onClick={() => toggleRow(evento.id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {isExpanded ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{fechaEventoActual ? format(fechaEventoActual, "dd/MM/yy") : "N/A"}</span>
                          {eventoRef ? (
                            <span className="text-xs font-medium text-muted-foreground">({eventoRef})</span>
                          ) : null}
                        </div>
                      </TableCell>
                      {showParcelaColumn ? <TableCell>{parcela?.nombre || "N/A"}</TableCell> : null}
                      <TableCell>{evento.categoria || getEventTypeDisplay(evento)}</TableCell>
                      <TableCell className="text-right">{formatHectareas(hectareasEvento)}</TableCell>
                      <TableCell>{productosDelEvento.length} Producto(s)</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{diasEntreEventos}</TableCell>
                      <TableCell className="text-right">{cicloEvento}</TableCell>
                      <TableCell className="text-right">${costoPorHa.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">
                        ${(evento.costoTotal || 0).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                    {isExpanded && showProducts
                      ? productosDelEvento.map((producto, index) => {
                          const insumo = producto.insumoId ? insumosById.get(producto.insumoId) : undefined;
                          const metrics = getProductoMetrics(producto, insumo, evento, superficieParcela);

                          return (
                            <TableRow key={`${evento.id}-${index}`} className="bg-muted/10 hover:bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              {showParcelaColumn ? <TableCell></TableCell> : null}
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="pl-8 text-sm">{insumo?.nombre || "N/A"}</TableCell>
                              <TableCell className="text-right text-sm">
                                {metrics.dosisHa > 0 ? `${metrics.dosisHa.toFixed(2)} ${insumo?.unidad || ""}/ha` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {metrics.cantidadTotal > 0 ? `${metrics.cantidadTotal.toFixed(2)} ${insumo?.unidad || ""}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                ${metrics.precioUnitario.toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                ${metrics.costoProducto.toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right text-sm">
                                ${metrics.costoPorHa.toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          );
                        })
                      : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-primary/10 text-lg font-bold">
                <TableCell colSpan={showParcelaColumn ? 13 : 12}>Costo Total Acumulado</TableCell>
                <TableCell className="text-right">
                  ${costoTotalGeneral.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

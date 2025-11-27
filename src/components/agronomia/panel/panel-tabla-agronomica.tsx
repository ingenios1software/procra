
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

interface PanelTablaAgronomicaProps {
    parcela: Parcela;
    zafra: Zafra;
    eventos: Evento[];
    insumos: Insumo[];
}

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
    
    const fechaSiembra = zafra.fechaSiembra ? new Date(zafra.fechaSiembra) : null;
    let costoTotalGeneral = 0;

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
                                <TableHead>Fecha</TableHead>
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
                                const diasEntreEventos = index > 0 ? differenceInDays(new Date(evento.fecha), new Date(eventos[index-1].fecha)) : 0;
                                const cicloEvento = fechaSiembra ? differenceInDays(new Date(evento.fecha), fechaSiembra) : 0;
                                const costoPorHa = parcela.superficie > 0 ? (evento.costoTotal || 0) / parcela.superficie : 0;
                                costoTotalGeneral += evento.costoTotal || 0;

                                const productosDelEvento = evento.productos || (evento.insumoId ? [{ insumoId: evento.insumoId, cantidad: evento.cantidad, dosis: evento.dosis }] : []);
                                
                                return (
                                    <React.Fragment key={evento.id}>
                                        <TableRow className={cn("font-semibold cursor-pointer", getRowColor(evento.categoria))} onClick={() => toggleRow(evento.id)}>
                                            <TableCell><Button variant="ghost" size="icon" className="h-6 w-6">{isExpanded ? <ChevronDown /> : <ChevronRight />}</Button></TableCell>
                                            <TableCell>{format(new Date(evento.fecha), 'dd/MM/yy')}</TableCell>
                                            <TableCell>{evento.categoria || evento.tipo}</TableCell>
                                            <TableCell>{productosDelEvento.length} Producto(s)</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{diasEntreEventos}</TableCell>
                                            <TableCell className="text-right">{cicloEvento}</TableCell>
                                            <TableCell className="text-right">${costoPorHa.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold">${(evento.costoTotal || 0).toLocaleString('es-AR')}</TableCell>
                                        </TableRow>
                                        {isExpanded && showProducts && productosDelEvento.map((prod, prodIndex) => {
                                            const insumo = insumos.find(i => i.id === prod.insumoId);
                                            const costoProducto = (prod.cantidad || 0) * (insumo?.costoUnitario || 0);

                                            return (
                                                <TableRow key={`${evento.id}-${prodIndex}`} className="bg-muted/10 hover:bg-muted/30">
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8 text-sm">{insumo?.nombre || 'N/A'}</TableCell>
                                                    <TableCell className="text-right text-sm">{prod.dosis?.toFixed(2)} {insumo?.unidad}/ha</TableCell>
                                                    <TableCell className="text-right text-sm">{prod.cantidad?.toFixed(2)} {insumo?.unidad}</TableCell>
                                                    <TableCell className="text-right text-sm">${(insumo?.costoUnitario || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right text-sm">${costoProducto.toLocaleString('es-AR')}</TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
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
                                <TableCell className="text-right">${costoTotalGeneral.toLocaleString('es-AR')}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

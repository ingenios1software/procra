"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, AlertCircle, Package, DollarSign, ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insumo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { InsumoForm } from "./insumo-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mockEventos } from "@/lib/mock-data";
import { PageHeader } from "../shared/page-header";

interface StockListProps {
  initialInsumos: Insumo[];
}

export function StockList({ initialInsumos }: StockListProps) {
  const [insumos, setInsumos] = useState(initialInsumos);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador' || role === 'gerente';

  const stockData = useMemo(() => {
    const salidas = mockEventos.flatMap(evento => evento.productos || [])
      .reduce((acc, prod) => {
        acc[prod.insumoId] = (acc[prod.insumoId] || 0) + prod.cantidad;
        return acc;
      }, {} as Record<string, number>);

    return insumos.map(insumo => {
      const entradaTotal = insumo.stockActual;
      const salidaTotal = salidas[insumo.id] || 0;
      const stockFinal = entradaTotal - salidaTotal;
      const valorStock = stockFinal * insumo.costoUnitario;

      return {
        ...insumo,
        entradaTotal,
        salidaTotal,
        stockFinal,
        valorStock
      };
    });
  }, [insumos]);

  const totalStockValue = useMemo(() => stockData.reduce((sum, item) => sum + item.valorStock, 0), [stockData]);
  const itemsBajoMinimo = useMemo(() => stockData.filter(item => item.stockFinal < item.stockMinimo).length, [stockData]);

  const handleSaveInsumo = useCallback((insumoData: Insumo) => {
    if (selectedInsumo) {
      setInsumos(prev => prev.map(i => i.id === insumoData.id ? insumoData : i));
    } else {
      setInsumos(prev => [...prev, { ...insumoData, id: `insumo-${Date.now()}` }]);
    }
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, [selectedInsumo]);

  const openDialog = useCallback((insumo?: Insumo) => {
    setSelectedInsumo(insumo || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, []);

  return (
    <>
      <PageHeader
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total del Stock</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalStockValue.toLocaleString('en-US')}</div>
                <p className="text-xs text-muted-foreground">Valor estimado del inventario actual</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items en Stock</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stockData.length}</div>
                <p className="text-xs text-muted-foreground">Total de insumos únicos</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items con Stock Bajo</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{itemsBajoMinimo}</div>
                <p className="text-xs text-muted-foreground">Insumos por debajo del stock mínimo</p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Inventario Detallado</CardTitle>
            <CardDescription>Análisis completo del movimiento de cada insumo.</CardDescription>
          </div>
          {canModify && (
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Insumo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Principio Activo</TableHead>
                <TableHead>Dosis Rec.</TableHead>
                <TableHead className="text-right">Precio Promedio</TableHead>
                <TableHead className="text-right">Entrada Total</TableHead>
                <TableHead className="text-right">Salida Total</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mínimo</TableHead>
                <TableHead className="text-right">Valor en Stock</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockData.map((insumo) => (
                <TableRow key={insumo.id} className={insumo.stockFinal < insumo.stockMinimo ? "bg-destructive/10" : ""}>
                  <TableCell className="font-medium">
                     <div className="flex items-center gap-2">
                        {insumo.stockFinal < insumo.stockMinimo && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Stock por debajo del mínimo</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {insumo.nombre}
                     </div>
                     <Badge variant="secondary" className="capitalize mt-1">{insumo.categoria}</Badge>
                  </TableCell>
                  <TableCell>{insumo.principioActivo || 'N/A'}</TableCell>
                  <TableCell>{insumo.dosisRecomendada ? `${insumo.dosisRecomendada} ${insumo.unidad}/ha` : 'N/A'}</TableCell>
                  <TableCell className="text-right font-mono">${insumo.costoUnitario.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 flex items-center justify-end gap-1"><ArrowUp size={14}/> {insumo.entradaTotal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono text-red-600 flex items-center justify-end gap-1"><ArrowDown size={14}/> {insumo.salidaTotal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{insumo.stockFinal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono">{insumo.stockMinimo.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">${insumo.valorStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  
                  {canModify && (
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(insumo)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Ver Movimientos
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedInsumo ? 'Editar Insumo' : 'Crear Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <InsumoForm 
            insumo={selectedInsumo}
            onSubmit={handleSaveInsumo}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

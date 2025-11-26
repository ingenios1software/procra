"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, AlertCircle } from "lucide-react";
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

interface StockListProps {
  initialInsumos: Insumo[];
}

export function StockList({ initialInsumos }: StockListProps) {
  const [insumos, setInsumos] = useState(initialInsumos);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador' || role === 'gerente';

  const handleSaveInsumo = (insumoData: Insumo) => {
    if (selectedInsumo) {
      setInsumos(prev => prev.map(i => i.id === insumoData.id ? insumoData : i));
    } else {
      setInsumos(prev => [...prev, { ...insumoData, id: `insumo-${Date.now()}` }]);
    }
    setDialogOpen(false);
    setSelectedInsumo(null);
  };

  const openDialog = (insumo?: Insumo) => {
    setSelectedInsumo(insumo || null);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Listado de Insumos</CardTitle>
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
                <TableHead>Categoría</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Stock Mínimo</TableHead>
                <TableHead>Proveedor</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {insumos.map((insumo) => (
                <TableRow key={insumo.id} className={insumo.stockActual < insumo.stockMinimo ? "bg-destructive/10" : ""}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {insumo.nombre}
                    {insumo.stockActual < insumo.stockMinimo && (
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
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{insumo.categoria}</Badge>
                  </TableCell>
                  <TableCell>{insumo.stockActual} {insumo.unidad}</TableCell>
                  <TableCell>{insumo.stockMinimo} {insumo.unidad}</TableCell>
                  <TableCell>{insumo.proveedor || 'N/A'}</TableCell>
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
                            Ajustar Stock
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedInsumo ? 'Editar Insumo' : 'Crear Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <InsumoForm 
            insumo={selectedInsumo}
            onSubmit={handleSaveInsumo}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

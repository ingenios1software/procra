"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insumo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
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
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador' || role === 'gerente';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Listado de Insumos</CardTitle>
        {canModify && (
          <Button>
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
                    <Button variant="ghost" size="sm">
                        Ajustar Stock
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
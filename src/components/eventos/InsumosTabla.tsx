"use client";

import React, { useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InsumoSelector } from "../insumos/InsumoSelector";
import { Trash2, PlusCircle } from "lucide-react";
import type { Insumo } from "@/lib/types";

interface ProductoField {
  id: string; // from useFieldArray
  insumo?: Insumo;
  dosis: number;
}

interface InsumosTablaProps {
  fields: ProductoField[];
  hectareas: number;
  append: (value: Partial<ProductoField>) => void;
  remove: (index: number) => void;
  update: (index: number, value: Partial<ProductoField>) => void;
}

export function InsumosTabla({ fields, hectareas, append, remove, update }: InsumosTablaProps) {

  const handleInsumoChange = useCallback((index: number, insumo: Insumo | undefined) => {
    update(index, { insumo });
  }, [update]);

  const handleDosisChange = useCallback((index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const newDosis = parseFloat(event.target.value) || 0;
    update(index, { dosis: newDosis });
  }, [update]);

  const valorTotalItems = fields.reduce((acc, field, index) => {
    const cantidad = (hectareas || 0) * (field.dosis || 0);
    const precio = field.insumo?.precioPromedioCalculado || field.insumo?.costoUnitario || 0;
    const valor = cantidad * precio;
    return acc + valor;
  }, 0);

  return (
    <>
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ítem</TableHead>
              <TableHead className="min-w-[300px]">Nombre del Insumo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Dosis/ha</TableHead>
              <TableHead>Cantidad Total</TableHead>
              <TableHead className="text-right">Precio Unitario</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const cantidadTotal = (hectareas || 0) * (field.dosis || 0);
              const precioUnitario = field.insumo?.precioPromedioCalculado || field.insumo?.costoUnitario || 0;
              const valorTotal = cantidadTotal * precioUnitario;

              return (
                <TableRow key={field.id}>
                  <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <InsumoSelector
                      value={field.insumo}
                      onChange={(insumo) => handleInsumoChange(index, insumo)}
                    />
                  </TableCell>
                  <TableCell>{field.insumo?.unidad || 'N/A'}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={field.dosis || ''}
                      onChange={(e) => handleDosisChange(index, e)}
                      placeholder="0"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell className="font-mono">{cantidadTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">${precioUnitario.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${valorTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
             {fields.length === 0 && (
                <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">No se han agregado productos.</TableCell>
                </TableRow>
             )}
          </TableBody>
          <TableFooter>
             <TableRow>
                <TableCell colSpan={6} className="text-right font-semibold">Valor Total de Items</TableCell>
                <TableCell className="text-right font-bold text-lg font-mono">${valorTotalItems.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell></TableCell>
             </TableRow>
          </TableFooter>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => append({ insumo: undefined, dosis: 0 })}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto
      </Button>
    </>
  );
}

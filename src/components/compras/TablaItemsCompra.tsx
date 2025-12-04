"use client";

import React, { useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InsumoSelector } from "@/components/insumos/InsumoSelector";
import { Trash2, PlusCircle } from "lucide-react";
import type { Insumo } from "@/lib/types";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";


interface ItemField {
  id: string; // from useFieldArray
  insumo?: Insumo;
  cantidad: number;
  precioUnitario: number;
  porcentajeIva: '0' | '5' | '10';
}

interface TablaItemsCompraProps {
  fields: ItemField[];
  append: (value: Partial<ItemField>) => void;
  remove: (index: number) => void;
  form: UseFormReturn<any>;
}

export function TablaItemsCompra({ fields, append, remove, form }: TablaItemsCompraProps) {

  return (
    <>
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 py-2 px-4">Ítem</TableHead>
              <TableHead className="min-w-[300px] py-2 px-4">Insumo</TableHead>
              <TableHead className="w-[120px] py-2 px-4">Cantidad</TableHead>
              <TableHead className="w-[150px] py-2 px-4">Precio Unitario</TableHead>
              <TableHead className="w-[120px] py-2 px-4">IVA</TableHead>
              <TableHead className="w-[150px] text-right py-2 px-4">Total</TableHead>
              <TableHead className="w-[50px] text-right py-2 px-4">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const cantidad = form.watch(`items.${index}.cantidad`) || 0;
              const precioUnitario = form.watch(`items.${index}.precioUnitario`) || 0;
              const totalItem = cantidad * precioUnitario;

              return (
                <TableRow key={field.id}>
                  <TableCell className="font-medium text-muted-foreground py-1 px-4">{index + 1}</TableCell>
                  <TableCell className="py-1 px-4 align-top">
                     <FormField
                        name={`items.${index}.insumo`}
                        control={form.control}
                        render={({ field: controllerField, fieldState }) => (
                            <FormItem>
                                <InsumoSelector
                                    value={controllerField.value}
                                    onChange={(insumo) => controllerField.onChange(insumo)}
                                />
                                {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                            </FormItem>
                        )}
                    />
                  </TableCell>
                  <TableCell className="py-1 px-4 align-top">
                    <FormField name={`items.${index}.cantidad`} control={form.control} render={({ field }) => (<Input type="number" placeholder="0" {...field} className="h-9" />)} />
                  </TableCell>
                  <TableCell className="py-1 px-4 align-top">
                    <FormField name={`items.${index}.precioUnitario`} control={form.control} render={({ field }) => (<Input type="number" placeholder="0" {...field} className="h-9" />)} />
                  </TableCell>
                   <TableCell className="py-1 px-4 align-top">
                     <FormField name={`items.${index}.porcentajeIva`} control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="10">10%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="0">Exento</SelectItem></SelectContent></Select>)} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold py-1 px-4 align-top">${totalItem.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-right py-1 px-4 align-top">
                    <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
             {fields.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">No se han agregado productos.</TableCell>
                </TableRow>
             )}
          </TableBody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => append({ insumo: undefined, cantidad: 0, precioUnitario: 0, porcentajeIva: '10' })}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem
      </Button>
    </>
  );
}

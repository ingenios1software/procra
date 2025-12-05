"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectorUniversal } from "@/components/common";
import { Trash2, PlusCircle, AlertTriangle } from "lucide-react";
import type { Insumo } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormMessage, FormItem } from "../ui/form";
import { query, collection, where, getDocs } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";


interface ProductoField {
  id: string;
  codigo?: string;     // NUEVO
  insumo?: Insumo;
  dosis: number;
}

interface InsumosTablaProps {
  fields: ProductoField[];
  hectareas: number;
  append: (value: Partial<ProductoField>) => void;
  remove: (index: number) => void;
  form: UseFormReturn<any>
}

const StockAlert = ({ insumo, cantidadNecesaria }: { insumo: Insumo, cantidadNecesaria: number }) => {
    const stockActual = insumo.stockActual || 0;
    const stockMinimo = insumo.stockMinimo || 0;

    if (cantidadNecesaria > stockActual) {
        return (
            <div className="flex items-center gap-1.5 mt-1.5 text-red-600 font-medium text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Stock insuficiente: necesita {cantidadNecesaria.toFixed(2)} y hay {stockActual.toFixed(2)}</span>
            </div>
        );
    }
    
    if (stockActual <= stockMinimo) {
        return (
            <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Stock bajo (quedan {stockActual.toFixed(2)} {insumo.unidad})</span>
            </div>
        );
    }

    return null;
}


export function InsumosTabla({ fields, hectareas, append, remove, form }: InsumosTablaProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSelectInsumo = (index: number, insumo: Insumo) => {
    form.setValue(`productos.${index}.insumo`, insumo, { shouldDirty: true });
    form.setValue(`productos.${index}.codigo`, insumo.numeroItem?.toString() || "", { shouldDirty: true });
    form.trigger(`productos.${index}.insumo`); // Re-validar el campo del insumo
  };
  
  const handleBuscarPorCodigo = async (index: number) => {
    const codigo = form.getValues(`productos.${index}.codigo`);
    if (!codigo || !firestore) return;

    const q = query(
      collection(firestore, "insumos"),
      where("numeroItem", "==", Number(codigo))
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      const insumo = { id: snap.docs[0].id, ...snap.docs[0].data() } as Insumo;
      handleSelectInsumo(index, insumo);
    } else {
      toast({
        variant: "destructive",
        title: "Código no encontrado",
        description: `No se encontró un insumo con el código "${codigo}"`,
      });
    }
  };
  
  return (
    <>
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 py-2 px-4">Ítem</TableHead>
              <TableHead className="min-w-[400px] py-2 px-4">Nombre del Insumo</TableHead>
              <TableHead className="py-2 px-4">Unidad</TableHead>
              <TableHead className="py-2 px-4">Dosis/ha</TableHead>
              <TableHead className="py-2 px-4">Cantidad Total</TableHead>
              <TableHead className="text-right py-2 px-4">Precio Unit.</TableHead>
              <TableHead className="text-right py-2 px-4">Valor</TableHead>
              <TableHead className="text-right py-2 px-4">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const insumo = form.watch(`productos.${index}.insumo`);
              const dosis = form.watch(`productos.${index}.dosis`) || 0;
              const cantidadTotal = (hectareas || 0) * dosis;
              const precioUnitario = insumo?.precioPromedioCalculado || insumo?.costoUnitario || 0;
              const valorTotal = cantidadTotal * precioUnitario;
              const codigoValue = form.watch(`productos.${index}.codigo`);

              return (
                <TableRow key={field.id}>
                  <TableCell className="font-medium text-muted-foreground py-1 px-4">{index + 1}</TableCell>
                  <TableCell className="py-1 px-4 align-top">
                    <FormField
                      control={form.control}
                      name={`productos.${index}.insumo`}
                      render={({ field: controllerField, fieldState }) => (
                        <FormItem>
                           <SelectorUniversal
                            label="Insumo"
                            collectionName="insumos"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={controllerField.value}
                            onSelect={(selectedInsumo) => handleSelectInsumo(index, selectedInsumo as Insumo)}
                            searchFields={['nombre', 'numeroItem', 'principioActivo']}
                            extraInfoFields={[
                              { label: 'Stock', field: 'stockActual', format: (val) => (val || 0).toLocaleString('de-DE') },
                              { label: 'Unidad', field: 'unidad'},
                              { label: 'Precio Prom.', field: 'precioPromedioCalculado', format: (val) => `$${(val || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}`},
                              { label: 'P.A.', field: 'principioActivo' },
                            ]}
                          />
                           {fieldState.error && <FormMessage />}
                           {controllerField.value && <StockAlert insumo={controllerField.value} cantidadNecesaria={cantidadTotal} />}
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="py-1 px-4 align-top">{insumo?.unidad || 'N/A'}</TableCell>
                  <TableCell className="py-1 px-4 align-top">
                    <FormField
                      control={form.control}
                      name={`productos.${index}.dosis`}
                      render={({ field: dosisField }) => (
                        <FormItem>
                          <Input
                            type="number"
                            placeholder="0"
                            className="w-24 h-9"
                            {...dosisField}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="font-mono py-1 px-4 align-top">{cantidadTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono py-1 px-4 align-top">${precioUnitario.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold py-1 px-4 align-top">${valorTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
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
                    <TableCell colSpan={8} className="text-center h-24">No se han agregado productos.</TableCell>
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
        onClick={() => append({ insumo: undefined, dosis: 0 })}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto
      </Button>
    </>
  );
}

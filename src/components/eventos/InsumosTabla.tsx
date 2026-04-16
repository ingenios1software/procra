"use client";

import React from "react";
import { UseFieldArrayRemove, UseFormReturn } from "react-hook-form";
import { AlertTriangle, PlusCircle, Trash2 } from "lucide-react";
import { SelectorUniversal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormMessage } from "../ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Insumo } from "@/lib/types";

interface ProductoField {
  insumo?: Insumo;
  cantidad: number;
  dosis: number;
  codigo: string;
}

interface InsumosTablaProps {
  fields: Record<"id", string>[];
  hectareas: number;
  append: (value: ProductoField) => void;
  remove: UseFieldArrayRemove;
  form: UseFormReturn<any>;
}

function StockAlert({ insumo, cantidadNecesaria }: { insumo: Insumo; cantidadNecesaria: number }) {
  const stockActual = insumo.stockActual || 0;
  const stockMinimo = insumo.stockMinimo || 0;

  if (cantidadNecesaria > stockActual) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[16px] font-medium text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Stock insuficiente: necesita {cantidadNecesaria.toFixed(2)} y hay {stockActual.toFixed(2)}
        </span>
      </div>
    );
  }

  if (stockActual <= stockMinimo) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[16px] text-amber-600">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Stock bajo (quedan {stockActual.toFixed(2)} {insumo.unidad})
        </span>
      </div>
    );
  }

  return null;
}

export function InsumosTabla({ fields, hectareas, append, remove, form }: InsumosTablaProps) {
  const [autoFocusFieldId, setAutoFocusFieldId] = React.useState<string | null>(null);
  const [pendingAppendFocus, setPendingAppendFocus] = React.useState(false);

  React.useEffect(() => {
    if (!pendingAppendFocus || fields.length === 0) return;

    const lastFieldId = fields[fields.length - 1]?.id;
    if (!lastFieldId) return;

    setAutoFocusFieldId(lastFieldId);
    setPendingAppendFocus(false);
  }, [fields, pendingAppendFocus]);

  const handleSelectInsumo = (index: number, insumo: Insumo | undefined) => {
    if (!insumo) return;

    form.setValue(`productos.${index}.insumo`, insumo, { shouldDirty: true });
    form.setValue(`productos.${index}.codigo`, insumo.numeroItem?.toString() || "", {
      shouldDirty: true,
    });
    form.trigger(`productos.${index}.insumo`);
  };

  const handleAppendProducto = React.useCallback(() => {
    append({ insumo: undefined, cantidad: 0, dosis: 0, codigo: "" });
    setPendingAppendFocus(true);
  }, [append]);

  const clearAutoFocusField = React.useCallback((fieldId: string) => {
    setAutoFocusFieldId((current) => (current === fieldId ? null : current));
  }, []);

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table resizable>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 px-4 py-3 text-[17px] font-semibold">Item</TableHead>
              <TableHead className="min-w-[400px] px-4 py-3 text-[17px] font-semibold">
                Nombre del Insumo
              </TableHead>
              <TableHead className="px-4 py-3 text-[17px] font-semibold">Unidad</TableHead>
              <TableHead className="px-4 py-3 text-[17px] font-semibold">Dosis/ha</TableHead>
              <TableHead className="px-4 py-3 text-[17px] font-semibold">Cantidad Total</TableHead>
              <TableHead className="px-4 py-3 text-right text-[17px] font-semibold">
                Precio Unit.
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-[17px] font-semibold">Valor</TableHead>
              <TableHead className="px-4 py-3 text-right text-[17px] font-semibold">Accion</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {fields.map((field, index) => {
              const insumo = form.watch(`productos.${index}.insumo`);
              const cantidadTotal = Number(form.watch(`productos.${index}.cantidad`)) || 0;
              const hectareasAplicadas = Number(hectareas) || 0;
              const dosisCalculada =
                hectareasAplicadas > 0 && cantidadTotal > 0 ? cantidadTotal / hectareasAplicadas : 0;
              const precioUnitario = insumo?.precioPromedioCalculado || insumo?.costoUnitario || 0;
              const valorTotal = cantidadTotal * precioUnitario;

              return (
                <TableRow key={field.id}>
                  <TableCell className="px-4 py-2 text-[17px] font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-top text-[17px]">
                    <FormField
                      control={form.control}
                      name={`productos.${index}.insumo`}
                      render={({ field: controllerField, fieldState }) => (
                        <FormItem>
                          <SelectorUniversal<Insumo>
                            label="Insumo"
                            collectionName="insumos"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={controllerField.value}
                            onSelect={(selectedInsumo) => handleSelectInsumo(index, selectedInsumo)}
                            searchFields={["nombre", "numeroItem", "principioActivo"]}
                            autoFocus={autoFocusFieldId === field.id}
                            onAutoFocusApplied={() => clearAutoFocusField(field.id)}
                            extraInfoFields={[
                              {
                                label: "Stock",
                                field: "stockActual",
                                format: (val) => (val || 0).toLocaleString("de-DE"),
                              },
                              { label: "Unidad", field: "unidad" },
                              {
                                label: "Precio Prom.",
                                field: "precioPromedioCalculado",
                                format: (val) =>
                                  `$${(val || 0).toLocaleString("de-DE", {
                                    minimumFractionDigits: 2,
                                  })}`,
                              },
                              { label: "P.A.", field: "principioActivo" },
                            ]}
                          />

                          {fieldState.error && <FormMessage />}
                          {controllerField.value && (
                            <StockAlert
                              insumo={controllerField.value}
                              cantidadNecesaria={cantidadTotal}
                            />
                          )}
                        </FormItem>
                      )}
                    />
                  </TableCell>

                  <TableCell className="px-4 py-2 align-top text-[17px]">
                    {insumo?.unidad || "N/A"}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-top">
                    <FormItem>
                      <Input
                        type="number"
                        placeholder={hectareasAplicadas > 0 ? "0" : "Ingrese ha"}
                        className="h-11 w-24 bg-muted/50 text-[17px] sm:text-[17px]"
                        value={
                          hectareasAplicadas > 0 && cantidadTotal > 0
                            ? dosisCalculada.toFixed(5)
                            : ""
                        }
                        readOnly
                        tabIndex={-1}
                      />
                    </FormItem>
                  </TableCell>

                  <TableCell className="px-4 py-2 align-top">
                    <FormField
                      control={form.control}
                      name={`productos.${index}.cantidad`}
                      render={({ field: cantidadField }) => (
                        <FormItem>
                          <Input
                            type="number"
                            step="any"
                            placeholder="0"
                            className="h-11 w-28 font-mono text-[17px] sm:text-[17px]"
                            {...cantidadField}
                            value={cantidadField.value ?? ""}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top text-right font-mono text-[17px]">
                    ${precioUnitario.toFixed(2)}
                  </TableCell>
                  <TableCell className="px-4 py-2 align-top text-right font-mono text-[17px] font-semibold">
                    {valorTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-top text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-[17px]">
                  No se han agregado productos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 h-11 px-4 text-[17px]"
        onClick={handleAppendProducto}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Agregar Producto
      </Button>
    </>
  );
}

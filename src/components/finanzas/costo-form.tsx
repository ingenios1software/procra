"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Costo, Parcela, Cultivo, Zafra } from "@/lib/types";
import { format } from "date-fns";
import React from "react";

const formSchema = z.object({
  descripcion: z.string().min(3, "La descripción es muy corta."),
  monto: z.coerce.number().positive("El monto debe ser un número positivo."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  tipo: z.enum(['insumo', 'maquinaria', 'combustible', 'mano de obra', 'otros']),
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().optional(),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
});

type CostoFormValues = z.infer<typeof formSchema>;

interface CostoFormProps {
  costo?: Partial<Costo> | null;
  onSubmit: (data: Omit<Costo, 'id'>) => void;
  onCancel: () => void;
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
}

function dateToInputValue(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const CostoForm = React.memo(({ costo, onSubmit, onCancel, parcelas, cultivos, zafras }: CostoFormProps) => {
  const form = useForm<CostoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descripcion: costo?.descripcion || "",
      monto: costo?.monto || 0,
      fecha: costo?.fecha ? new Date(costo.fecha) : new Date(),
      tipo: costo?.tipo || 'insumo',
      parcelaId: costo?.parcelaId || "",
      cultivoId: costo?.cultivoId || "",
      zafraId: costo?.zafraId || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción del Costo</FormLabel>
              <FormControl><Input placeholder="Ej: Compra de fertilizante" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="monto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto ($)</FormLabel>
                <FormControl><Input type="number" placeholder="5000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha del Costo</FormLabel>
                <FormControl>
                  <Input
                    type="date" lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(e) => field.onChange(inputValueToDate(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Costo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="maquinaria">Maquinaria</SelectItem>
                  <SelectItem value="combustible">Combustible</SelectItem>
                  <SelectItem value="mano de obra">Mano de Obra</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={form.control} name="parcelaId" render={({ field }) => ( <FormItem> <FormLabel>Parcela</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl> <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
          <FormField control={form.control} name="cultivoId" render={({ field }) => ( <FormItem> <FormLabel>Cultivo (Opcional)</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl> <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
          <FormField control={form.control} name="zafraId" render={({ field }) => ( <FormItem> <FormLabel>Zafra</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl> <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{costo?.id ? "Guardar Cambios" : "Crear Costo"}</Button>
        </div>
      </form>
    </Form>
  );
});

CostoForm.displayName = 'CostoForm';


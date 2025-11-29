"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Venta, Parcela, Cultivo, Zafra, Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import React from "react";

const formSchema = z.object({
  clienteId: z.string().optional(),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  toneladas: z.coerce.number().positive("Las toneladas deben ser un número positivo."),
  precioTonelada: z.coerce.number().positive("El precio por tonelada debe ser un número positivo."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
});

type VentaFormValues = z.infer<typeof formSchema>;

interface VentaFormProps {
  venta?: Partial<Venta> | null;
  onSubmit: (data: Omit<Venta, 'id'>) => void;
  onCancel: () => void;
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  clientes: Cliente[];
}

export const VentaForm = React.memo(({ venta, onSubmit, onCancel, parcelas, cultivos, zafras, clientes }: VentaFormProps) => {
  const form = useForm<VentaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: venta ? {
      ...venta,
      fecha: new Date(venta.fecha as string),
      precioTonelada: venta.precioTonelada
    } : {
      fecha: new Date(),
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <FormField control={form.control} name="clienteId" render={({ field }) => ( <FormItem> <FormLabel>Cliente</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger></FormControl> <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
           <FormField control={form.control} name="cultivoId" render={({ field }) => ( <FormItem> <FormLabel>Cultivo</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cultivo" /></SelectTrigger></FormControl> <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="parcelaId" render={({ field }) => ( <FormItem> <FormLabel>Parcela de Origen</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una parcela" /></SelectTrigger></FormControl> <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
          <FormField control={form.control} name="zafraId" render={({ field }) => ( <FormItem> <FormLabel>Zafra</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl> <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="toneladas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Toneladas Vendidas</FormLabel>
                <FormControl><Input type="number" placeholder="150" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="precioTonelada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio por Tonelada ($)</FormLabel>
                <FormControl><Input type="number" placeholder="300" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2">
                <FormLabel>Fecha de Venta</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{venta?.id ? "Guardar Cambios" : "Crear Venta"}</Button>
        </div>
      </form>
    </Form>
  );
});

VentaForm.displayName = 'VentaForm';

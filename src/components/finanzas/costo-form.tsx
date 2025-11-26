"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Costo, Parcela, Cultivo, Zafra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

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
  costo?: Costo | null;
  onSubmit: (data: Costo) => void;
  onCancel: () => void;
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
}

export function CostoForm({ costo, onSubmit, onCancel, parcelas, cultivos, zafras }: CostoFormProps) {
  const form = useForm<CostoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descripcion: costo?.descripcion || "",
      monto: costo?.monto || 0,
      fecha: costo?.fecha || new Date(),
      tipo: costo?.tipo || 'insumo',
      parcelaId: costo?.parcelaId || "",
      cultivoId: costo?.cultivoId || "",
      zafraId: costo?.zafraId || "",
    },
  });

  const handleSubmit = (data: CostoFormValues) => {
    onSubmit({
      id: costo?.id || "", // Ensure id is handled
      ...data,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
              <FormItem className="flex flex-col pt-2">
                <FormLabel>Fecha del Costo</FormLabel>
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
          <Button type="submit">{costo ? "Guardar Cambios" : "Crear Costo"}</Button>
        </div>
      </form>
    </Form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Zafra, Cultivo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import React from "react";
import { mockCultivos } from "@/lib/mock-data";

const formSchema = z.object({
  nombre: z.string().min(5, "El nombre debe tener al menos 5 caracteres."),
  cultivoId: z.string().optional(),
  fechaInicio: z.date({ required_error: "La fecha de inicio es obligatoria." }),
  estado: z.enum(["planificada", "en curso", "finalizada"]),
});

type ZafraFormValues = z.infer<typeof formSchema>;

interface ZafraFormProps {
  zafra?: Zafra;
  onSubmit: (data: Zafra) => void;
  onCancel: () => void;
}

export const ZafraForm = React.memo(({ zafra, onSubmit, onCancel }: ZafraFormProps) => {
  const form = useForm<ZafraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: zafra?.nombre || "",
      cultivoId: zafra?.cultivoId || "",
      fechaInicio: zafra?.fechaInicio ? new Date(zafra.fechaInicio) : new Date(),
      estado: zafra?.estado || "planificada",
    },
  });

  const handleSubmit = (data: ZafraFormValues) => {
    onSubmit({
      id: zafra?.id || "",
      fechaFin: zafra?.fechaFin,
      ...data,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Zafra/Campaña</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Soja Temprana - Lote 1 - 24/25" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="cultivoId"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Cultivo Asociado (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un cultivo" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {mockCultivos.map(cultivo => (
                                <SelectItem key={cultivo.id} value={cultivo.id}>{cultivo.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormDescription>Asociar un cultivo ayuda a organizar y filtrar los análisis.</FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
          control={form.control}
          name="fechaInicio"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha de Inicio</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date("1990-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!zafra}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="planificada">Planificada</SelectItem>
                  <SelectItem value="en curso">En Curso</SelectItem>
                  <SelectItem value="finalizada" disabled>Finalizada</SelectItem>
                </SelectContent>
              </Select>
              {!!zafra && <FormDescription>El estado no puede ser modificado una vez creada la zafra.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{zafra ? "Guardar Cambios" : "Crear Zafra"}</Button>
        </div>
      </form>
    </Form>
  );
});

ZafraForm.displayName = 'ZafraForm';

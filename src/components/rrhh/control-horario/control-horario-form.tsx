"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ControlHorario, Empleado } from "@/lib/types";

const formSchema = z.object({
  empleadoId: z.string().nonempty("Debe seleccionar un empleado."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  horasTrabajadas: z.coerce.number().positive("Las horas deben ser un número positivo."),
  observacion: z.string().optional(),
});

type FormValues = Omit<ControlHorario, 'id' | 'creadoEn' | 'creadoPor' | 'estado'>;

interface ControlHorarioFormProps {
  registro?: ControlHorario | null;
  empleados: Empleado[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export function ControlHorarioForm({ registro, empleados, onSubmit, onCancel }: ControlHorarioFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: registro ? {
        ...registro,
        fecha: new Date(registro.fecha as string),
    } : {
      fecha: new Date(),
      horasTrabajadas: 8,
    },
  });

  const isReadOnly = registro?.estado === 'aprobado' || registro?.estado === 'rechazado';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <fieldset disabled={isReadOnly} className="space-y-6">
          <FormField
            control={form.control}
            name="empleadoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empleado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un empleado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.apellido}, {e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
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
            <FormField
              control={form.control}
              name="horasTrabajadas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horas Trabajadas</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="8.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="observacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observación</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notas adicionales sobre la jornada..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          {!isReadOnly && (
            <Button type="submit">
              {registro ? "Guardar Cambios" : "Crear Registro"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

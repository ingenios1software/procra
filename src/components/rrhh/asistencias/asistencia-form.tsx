"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Asistencia, Empleado } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const formSchema = z.object({
  empleadoId: z.string().min(1, "Debe seleccionar un empleado."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  horaEntrada: z.string().regex(timeRegex, "Formato de hora inválido (HH:mm)."),
  horaSalida: z.string().regex(timeRegex, "Formato de hora inválido (HH:mm)."),
  observaciones: z.string().optional(),
});

type AsistenciaFormValues = z.infer<typeof formSchema>;

interface AsistenciaFormProps {
  asistencia?: Partial<Asistencia> | null;
  empleados: Empleado[];
  onSubmit: (data: Omit<Asistencia, "id">) => void;
  onCancel: () => void;
}

export function AsistenciaForm({
  asistencia,
  empleados,
  onSubmit,
  onCancel,
}: AsistenciaFormProps) {
  const form = useForm<AsistenciaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: asistencia
      ? {
          ...asistencia,
          fecha: new Date(asistencia.fecha as string),
        }
      : {
          empleadoId: "",
          fecha: new Date(),
          horaEntrada: "07:00",
          horaSalida: "17:00",
          observaciones: "",
        },
  });

  const handleSubmit = (data: AsistenciaFormValues) => {
    onSubmit({ ...data, fecha: data.fecha.toISOString() });
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="empleadoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empleado</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un empleado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {empleados.map((empleado) => (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {empleado.nombre} {empleado.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2">
                <FormLabel>Fecha</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Elige una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="horaEntrada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora de Entrada</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="horaSalida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora de Salida</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="observaciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Anotaciones sobre la jornada..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {asistencia ? "Guardar Cambios" : "Crear Registro"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

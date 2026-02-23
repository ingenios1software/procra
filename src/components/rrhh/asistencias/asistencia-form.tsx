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
import type { Asistencia, Empleado } from "@/lib/types";
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

function dateToInputValue(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
              <FormItem>
                <FormLabel>Fecha</FormLabel>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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



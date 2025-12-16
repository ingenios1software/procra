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
import type { ControlHorario, Empleado, Parcela } from "@/lib/types";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const formSchema = z.object({
  empleadoId: z.string().nonempty("Debe seleccionar un empleado."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  horaEntrada: z.string().regex(timeRegex, "Formato HH:mm"),
  horaSalida: z.string().regex(timeRegex, "Formato HH:mm"),
  observacion: z.string().optional(),
  parcelaId: z.string().optional(),
  tipoTrabajo: z.string().optional(),
}).refine(data => {
    if (!data.horaEntrada || !data.horaSalida) return true;
    return data.horaSalida > data.horaEntrada;
}, {
    message: "La hora de salida debe ser posterior a la de entrada.",
    path: ["horaSalida"],
});

type FormValues = Omit<ControlHorario, 'id' | 'creadoEn' | 'creadoPor' | 'estado' | 'horasAm' | 'horasPm' | 'horasTotales' | 'aprobadoEn' | 'aprobadoPor' | 'costoManoDeObra'>;

interface ControlHorarioFormProps {
  registro?: ControlHorario | null;
  empleados: Empleado[];
  parcelas: Parcela[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

const tiposDeTrabajo = [
    "Siembra", "Cosecha", "Aplicación", "Fertilización", "Mantenimiento", "Labores Generales", "Monitoreo", "Otro"
];

export function ControlHorarioForm({ registro, empleados, parcelas, onSubmit, onCancel }: ControlHorarioFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: registro ? {
        ...registro,
        fecha: new Date(registro.fecha as string),
    } : {
      fecha: new Date(),
      horaEntrada: "07:00",
      horaSalida: "17:00",
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
                name="parcelaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcela</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una parcela (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Ninguna</SelectItem>
                        {parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="tipoTrabajo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Trabajo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Ninguno</SelectItem>
                        {tiposDeTrabajo.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>
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
            {isReadOnly ? "Cerrar" : "Cancelar"}
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

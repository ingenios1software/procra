"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Empleado } from "@/lib/types";
import { format } from "date-fns";

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto."),
  apellido: z.string().min(2, "El apellido es muy corto."),
  documento: z.string().min(5, "El documento es muy corto."),
  puesto: z.string().min(3, "El puesto es muy corto."),
  salario: z.coerce.number().positive("El salario debe ser un numero positivo."),
  fechaNacimiento: z.date({ required_error: "La fecha de nacimiento es obligatoria." }),
  fechaContratacion: z.date({ required_error: "La fecha de contratacion es obligatoria." }),
  estado: z.enum(["activo", "inactivo", "de vacaciones"]),
  telefono: z.string().optional(),
  email: z.string().email("Email invalido.").optional().or(z.literal("")),
  direccion: z.string().optional(),
});

type EmpleadoFormValues = z.infer<typeof formSchema>;

interface EmpleadoFormProps {
  empleado?: Partial<Empleado> | null;
  onSubmit: (data: Omit<Empleado, "id">) => void;
  onCancel: () => void;
}

function dateToInputValue(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function EmpleadoForm({ empleado, onSubmit, onCancel }: EmpleadoFormProps) {
  const form = useForm<EmpleadoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: empleado
      ? {
          ...empleado,
          fechaNacimiento: new Date(empleado.fechaNacimiento as string),
          fechaContratacion: new Date(empleado.fechaContratacion as string),
        }
      : {
          nombre: "",
          apellido: "",
          documento: "",
          puesto: "",
          salario: 0,
          estado: "activo",
        },
  });

  const handleSubmit = (data: EmpleadoFormValues) => {
    onSubmit({
      ...data,
      fechaNacimiento: data.fechaNacimiento.toISOString(),
      fechaContratacion: data.fechaContratacion.toISOString(),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombres</FormLabel>
                <FormControl>
                  <Input placeholder="Juan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellidos</FormLabel>
                <FormControl>
                  <Input placeholder="Perez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="documento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nro de Documento</FormLabel>
                <FormControl>
                  <Input placeholder="1.234.567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="fechaNacimiento"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Nacimiento</FormLabel>
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
          name="direccion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Direccion</FormLabel>
              <FormControl>
                <Input placeholder="Av. Siempre Viva 123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefono</FormLabel>
                <FormControl>
                  <Input placeholder="0981 123 456" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="empleado@crapro95.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <hr className="my-4 sm:my-6" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="puesto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Puesto / Cargo</FormLabel>
                <FormControl>
                  <Input placeholder="Operador de Maquinaria" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salario Mensual ($)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            name="fechaContratacion"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Contratacion</FormLabel>
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
          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="de vacaciones">De Vacaciones</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{empleado?.id ? "Guardar Cambios" : "Crear Empleado"}</Button>
        </div>
      </form>
    </Form>
  );
}



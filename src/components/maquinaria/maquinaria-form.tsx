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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Maquinaria } from "@/lib/types";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre es muy corto."),
  tipo: z.enum(['tractor', 'pulverizadora', 'camioneta', 'cosechadora', 'otro']),
  modelo: z.string().optional(),
  año: z.coerce.number().optional(),
  horasTrabajo: z.coerce.number().min(0, "Las horas no pueden ser negativas."),
  estado: z.enum(['operativa', 'en mantenimiento', 'fuera de servicio']),
});

type MaquinariaFormValues = z.infer<typeof formSchema>;

interface MaquinariaFormProps {
  maquinaria?: Partial<Maquinaria> | null;
  onSubmit: (data: MaquinariaFormValues) => void;
  onCancel: () => void;
}

export function MaquinariaForm({
  maquinaria,
  onSubmit,
  onCancel,
}: MaquinariaFormProps) {
  const form = useForm<MaquinariaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: maquinaria || {
      nombre: "",
      tipo: "tractor",
      horasTrabajo: 0,
      estado: "operativa",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre o Identificación</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Tractor John Deere 7230J" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Maquinaria</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tractor">Tractor</SelectItem>
                    <SelectItem value="cosechadora">Cosechadora</SelectItem>
                    <SelectItem value="pulverizadora">Pulverizadora</SelectItem>
                    <SelectItem value="camioneta">Camioneta</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
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
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="operativa">Operativa</SelectItem>
                    <SelectItem value="en mantenimiento">En Mantenimiento</SelectItem>
                    <SelectItem value="fuera de servicio">Fuera de Servicio</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="modelo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 7230J" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="año"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Año de Fabricación</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="2022" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="horasTrabajo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horas de Trabajo (Horómetro)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1250" {...field} />
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
            {maquinaria ? "Guardar Cambios" : "Crear Maquinaria"}
          </Button>
        </div>
      </form>
    </Form>
  );
}


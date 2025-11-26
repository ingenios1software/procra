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
import type { CentroDeCosto } from "@/lib/types";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre es muy corto."),
  descripcion: z.string().min(5, "La descripción es muy corta."),
  categoria: z.enum(
    ["campo", "parcela", "cultivo", "maquinaria", "general"],
    {
      required_error: "Debe seleccionar una categoría.",
    }
  ),
});

type CentroDeCostoFormValues = z.infer<typeof formSchema>;

interface CentroDeCostoFormProps {
  centro?: CentroDeCosto | null;
  onSubmit: (data: Omit<CentroDeCosto, "id">) => void;
  onCancel: () => void;
}

export function CentroDeCostoForm({
  centro,
  onSubmit,
  onCancel,
}: CentroDeCostoFormProps) {
  const form = useForm<CentroDeCostoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: centro || {
      nombre: "",
      descripcion: "",
      categoria: "general",
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
              <FormLabel>Nombre del Centro de Costo</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Administración" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoria"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="campo">Campo</SelectItem>
                  <SelectItem value="parcela">Parcela</SelectItem>
                  <SelectItem value="cultivo">Cultivo</SelectItem>
                  <SelectItem value="maquinaria">Maquinaria</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describa el propósito de este centro de costo."
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
            {centro ? "Guardar Cambios" : "Crear Centro"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

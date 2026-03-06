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
  descripcion: z.string().min(5, "La descripcion es muy corta."),
  categoria: z.enum(["campo", "parcela", "cultivo", "maquinaria", "general"]),
});

type CentroDeCostoFormValues = z.infer<typeof formSchema>;

interface CentroDeCostoFormProps {
  centro?: Partial<CentroDeCosto> | null;
  onSubmit: (data: CentroDeCostoFormValues) => void;
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Centro de Costo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Administracion General" {...field} />
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
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una categoria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="campo">Campo</SelectItem>
                    <SelectItem value="parcela">Parcela</SelectItem>
                    <SelectItem value="cultivo">Cultivo</SelectItem>
                    <SelectItem value="maquinaria">Maquinaria</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripcion</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[110px]"
                  placeholder="Descripcion del proposito de este centro de costo."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {centro?.id ? "Guardar Cambios" : "Crear Centro"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

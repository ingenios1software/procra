"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Cultivo } from "@/lib/types";
import React from "react";

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  descripcion: z.string().min(5, "La descripcion es muy corta."),
});

type CultivoFormValues = z.infer<typeof formSchema>;

interface CultivoFormProps {
  cultivo?: Partial<Cultivo>;
  onSubmit: (data: CultivoFormValues) => void;
  onCancel: () => void;
}

export const CultivoForm = React.memo(({ cultivo, onSubmit, onCancel }: CultivoFormProps) => {
  const form = useForm<CultivoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: cultivo?.nombre || "",
      descripcion: cultivo?.descripcion || "",
    },
  });

  const handleSubmit = (data: CultivoFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Cultivo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Soja" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripcion</FormLabel>
                <FormControl>
                  <Textarea className="min-h-[110px]" placeholder="Ej: Variedad de ciclo corto..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{cultivo?.id ? "Guardar Cambios" : "Crear Cultivo"}</Button>
        </div>
      </form>
    </Form>
  );
});

CultivoForm.displayName = "CultivoForm";

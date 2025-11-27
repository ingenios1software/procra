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
  descripcion: z.string().min(5, "La descripción es muy corta."),
});

type CultivoFormValues = z.infer<typeof formSchema>;

interface CultivoFormProps {
  cultivo?: Cultivo;
  onSubmit: (data: Cultivo) => void;
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
    onSubmit({
      id: cultivo?.id || "",
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
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea placeholder="Ej: Variedad de ciclo corto..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{cultivo ? "Guardar Cambios" : "Crear Cultivo"}</Button>
        </div>
      </form>
    </Form>
  );
});

CultivoForm.displayName = 'CultivoForm';

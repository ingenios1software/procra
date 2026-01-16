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
import type { Deposito } from "@/lib/types";
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  sucursalId: z.string().optional(),
  descripcion: z.string().optional(),
  activo: z.boolean().default(true),
});

type DepositoFormValues = z.infer<typeof formSchema>;

interface DepositoFormProps {
  deposito?: Deposito | null;
  onSubmit: (data: DepositoFormValues) => void;
  onCancel: () => void;
}

export const DepositoForm = React.memo(({ deposito, onSubmit, onCancel }: DepositoFormProps) => {
  const form = useForm<DepositoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: deposito || {
      nombre: "",
      sucursalId: "",
      descripcion: "",
      activo: true,
    },
  });

  const handleSubmit = (data: DepositoFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Depósito</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Silo Principal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sucursalId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sucursal (ID)</FormLabel>
              <FormControl>
                <Input placeholder="Ej: 001" {...field} />
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
                <Textarea placeholder="Notas sobre el depósito" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="activo"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Activo</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Desactiva este depósito para ocultarlo en los selectores.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{deposito?.id ? "Guardar Cambios" : "Crear Depósito"}</Button>
        </div>
      </form>
    </Form>
  );
});

DepositoForm.displayName = 'DepositoForm';

    
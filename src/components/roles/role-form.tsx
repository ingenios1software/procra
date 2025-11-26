"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Rol, UserRole } from "@/lib/types";

const formSchema = z.object({
  nombre: z.enum(["admin", "operador", "consulta"], {
    errorMap: () => ({ message: "Debe seleccionar un nombre de rol válido." }),
  }),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
});

type RoleFormValues = z.infer<typeof formSchema>;

interface RoleFormProps {
  rol?: Rol | null;
  onSubmit: (data: Rol) => void;
  onCancel: () => void;
}

export function RoleForm({ rol, onSubmit, onCancel }: RoleFormProps) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: rol?.nombre || "consulta",
      descripcion: rol?.descripcion || "",
    },
  });

  const handleSubmit = (data: RoleFormValues) => {
    onSubmit({
      id: rol?.id || "",
      ...data,
      nombre: data.nombre as UserRole,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Rol</FormLabel>
              <FormControl>
                <Input placeholder="admin" {...field} />
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
                <Textarea placeholder="Describe los permisos de este rol..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{rol ? "Guardar Cambios" : "Crear Rol"}</Button>
        </div>
      </form>
    </Form>
  );
}

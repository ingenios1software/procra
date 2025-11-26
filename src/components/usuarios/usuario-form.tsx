"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Usuario, Rol, UserRole } from "@/lib/types";

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto."),
  email: z.string().email("Email inválido."),
  rol: z.enum(["admin", "operador", "consulta"]),
  activo: z.boolean(),
});

type UsuarioFormValues = z.infer<typeof formSchema>;

interface UsuarioFormProps {
  usuario?: Usuario | null;
  roles: Rol[];
  onSubmit: (data: Usuario) => void;
  onCancel: () => void;
}

export function UsuarioForm({ usuario, roles, onSubmit, onCancel }: UsuarioFormProps) {
  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: usuario?.nombre || "",
      email: usuario?.email || "",
      rol: usuario?.rol || "consulta",
      activo: usuario?.activo ?? true,
    },
  });

  const handleSubmit = (data: UsuarioFormValues) => {
    onSubmit({
      id: usuario?.id || "",
      ...data,
      rol: data.rol as UserRole,
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
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl><Input placeholder="Juan Perez" {...field} /></FormControl>
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
              <FormControl><Input type="email" placeholder="juan@ejemplo.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rol"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un rol" /></SelectTrigger></FormControl>
                <SelectContent>
                  {roles.map(rol => (
                    <SelectItem key={rol.id} value={rol.nombre}>{rol.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="activo"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Usuario Activo</FormLabel>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{usuario ? "Guardar Cambios" : "Crear Usuario"}</Button>
        </div>
      </form>
    </Form>
  );
}

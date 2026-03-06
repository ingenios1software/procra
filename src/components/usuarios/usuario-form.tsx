"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Usuario, Rol } from "@/lib/types";

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto."),
  email: z.string().email("Email invalido."),
  rolId: z.string().nonempty("Debe seleccionar un rol."),
  activo: z.boolean(),
});

type UsuarioFormValues = z.infer<typeof formSchema>;

interface UsuarioFormProps {
  usuario?: Partial<Usuario> | null;
  roles: Rol[];
  onSubmit: (data: Omit<Usuario, "id" | "rolNombre">) => void;
  onCancel: () => void;
}

export function UsuarioForm({ usuario, roles, onSubmit, onCancel }: UsuarioFormProps) {
  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: usuario?.nombre || "",
      email: usuario?.email || "",
      rolId: usuario?.rolId || "",
      activo: usuario?.activo ?? true,
    },
  });

  const handleSubmit = (data: UsuarioFormValues) => {
    // El rolNombre se agrega en el componente padre.
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Juan Perez" {...field} />
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
                  <Input type="email" placeholder="juan@ejemplo.com" {...field} disabled={!!usuario} />
                </FormControl>
                {!!usuario && (
                  <p className="text-sm leading-snug text-muted-foreground">
                    El email no se puede modificar para usuarios existentes.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <FormField
            control={form.control}
            name="rolId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rol</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un rol" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map((rol) => (
                      <SelectItem key={rol.id} value={rol.id} className="capitalize">
                        {rol.nombre}
                      </SelectItem>
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
              <FormItem className="flex h-full flex-row items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Usuario Activo</FormLabel>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{usuario?.id ? "Guardar Cambios" : "Crear Usuario"}</Button>
        </div>
      </form>
    </Form>
  );
}

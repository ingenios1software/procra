"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Rol, Permisos } from "@/lib/types";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";

const PERMISOS_DEFAULT: Permisos = {
    compras: false,
    stock: false,
    eventos: false,
    monitoreos: false,
    ventas: false,
    contabilidad: false,
    rrhh: false,
    finanzas: false,
    agronomia: false,
    maestros: false,
    administracion: false,
};

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  permisos: z.object({
    compras: z.boolean(),
    stock: z.boolean(),
    eventos: z.boolean(),
    monitoreos: z.boolean(),
    ventas: z.boolean(),
    contabilidad: z.boolean(),
    rrhh: z.boolean(),
    finanzas: z.boolean(),
    agronomia: z.boolean(),
    maestros: z.boolean(),
    administracion: z.boolean(),
  }),
  soloLectura: z.boolean(),
});

type RoleFormValues = z.infer<typeof formSchema>;

interface RoleFormProps {
  rol?: Rol | null;
  onSubmit: (data: Omit<Rol, 'id'>) => void;
  onCancel: () => void;
}

export function RoleForm({ rol, onSubmit, onCancel }: RoleFormProps) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: rol?.nombre || "",
      descripcion: rol?.descripcion || "",
      permisos: rol?.permisos || PERMISOS_DEFAULT,
      soloLectura: rol?.soloLectura || false,
    },
  });

  const handleSubmit = (data: RoleFormValues) => {
    onSubmit({
      ...data,
      esSistema: rol?.esSistema || false,
    });
  };

  const permisosKeys = Object.keys(PERMISOS_DEFAULT) as Array<keyof Permisos>;


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
                <Input placeholder="Ej: Gerente de Operaciones" {...field} />
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
                <Textarea placeholder="Describe los permisos y responsabilidades de este rol..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
            <FormLabel>Permisos del Módulo</FormLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2 p-4 border rounded-md">
                {permisosKeys.map((key) => (
                    <FormField
                        key={key}
                        control={form.control}
                        name={`permisos.${key}`}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={form.watch('soloLectura')}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal capitalize">{key}</FormLabel>
                            </FormItem>
                        )}
                    />
                ))}
            </div>
        </div>
        
        <FormField
            control={form.control}
            name="soloLectura"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel>Modo &quot;Solo Lectura&quot;</FormLabel>
                        <p className="text-sm text-muted-foreground">
                            Anula todos los permisos y solo permite ver la información.
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

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{rol ? "Guardar Cambios" : "Crear Rol"}</Button>
        </div>
      </form>
    </Form>
  );
}

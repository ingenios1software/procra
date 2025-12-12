"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { Card, CardContent } from "@/components/ui/card";
import type { Proveedor } from "@/lib/types";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre es muy corto."),
  ruc: z.string().min(5, "El RUC/DNI es muy corto."),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido.").optional().or(z.literal('')),
  ciudad: z.string().optional(),
  pais: z.string().optional(),
  contacto: z.string().optional(),
  observaciones: z.string().optional(),
  activo: z.boolean().default(true),
});

type ProveedorFormValues = z.infer<typeof formSchema>;

interface ProveedorFormProps {
  proveedor?: Proveedor | null;
  onSubmit: (data: ProveedorFormValues) => void;
  onCancel: () => void;
}

export function ProveedorForm({ proveedor, onSubmit, onCancel }: ProveedorFormProps) {
  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: proveedor || {
      nombre: "",
      ruc: "",
      activo: true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField name="nombre" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Nombre o Razón Social</FormLabel><FormControl><Input placeholder="Agro S.A." {...field} /></FormControl><FormMessage /></FormItem> )} />
          <FormField name="ruc" control={form.control} render={({ field }) => ( <FormItem><FormLabel>RUC / DNI</FormLabel><FormControl><Input placeholder="80012345-1" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
        <FormField name="direccion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input placeholder="Av. Principal 123" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField name="telefono" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="0981 123456" {...field} /></FormControl><FormMessage /></FormItem> )} />
          <FormField name="email" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="contacto@empresa.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField name="ciudad" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Ciudad</FormLabel><FormControl><Input placeholder="Asunción" {...field} /></FormControl><FormMessage /></FormItem> )} />
          <FormField name="pais" control={form.control} render={({ field }) => ( <FormItem><FormLabel>País</FormLabel><FormControl><Input placeholder="Paraguay" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
        <FormField name="contacto" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Persona de Contacto</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField name="observaciones" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Notas adicionales sobre el proveedor..." {...field} /></FormControl><FormMessage /></FormItem> )} />
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{proveedor ? "Guardar Cambios" : "Crear Proveedor"}</Button>
        </div>
      </form>
    </Form>
  );
}

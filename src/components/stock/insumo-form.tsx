"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Insumo } from "@/lib/types";
import React from "react";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  categoria: z.enum(['fertilizante', 'herbicida', 'fungicida', 'semilla', 'insecticida', 'otros']),
  principioActivo: z.string().optional(),
  unidad: z.enum(['kg', 'lt', 'unidad', 'ton']),
  dosisRecomendada: z.coerce.number().optional(),
  stockMinimo: z.coerce.number().min(0, "El stock mínimo no puede ser negativo."),
  proveedor: z.string().optional(),
});

type InsumoFormValues = z.infer<typeof formSchema>;

interface InsumoFormProps {
  insumo?: Partial<Insumo> | null;
  onSubmit: (data: InsumoFormValues) => void;
  onCancel: () => void;
}

export const InsumoForm = React.memo(({ insumo, onSubmit, onCancel }: InsumoFormProps) => {
  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: insumo ? {
        ...insumo,
        dosisRecomendada: insumo.dosisRecomendada || undefined,
        stockMinimo: insumo.stockMinimo || 0,
        proveedor: insumo.proveedor || ""
    } : {
      nombre: "",
      categoria: "otros",
      principioActivo: "",
      unidad: "unidad",
      dosisRecomendada: 0,
      stockMinimo: 0,
      proveedor: "",
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
              <FormLabel>Nombre del Insumo</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Urea" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <SelectItem value="semilla">Semilla</SelectItem>
                    <SelectItem value="fertilizante">Fertilizante</SelectItem>
                    <SelectItem value="herbicida">Herbicida</SelectItem>
                    <SelectItem value="fungicida">Fungicida</SelectItem>
                    <SelectItem value="insecticida">Insecticida</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="principioActivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Principio Activo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Glifosato" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="unidad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidad de Medida</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una unidad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                    <SelectItem value="lt">Litro (lt)</SelectItem>
                    <SelectItem value="ton">Tonelada (ton)</SelectItem>
                    <SelectItem value="unidad">Unidad</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="dosisRecomendada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dosis Recomendada (/ha)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 2.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="stockMinimo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Mínimo</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="proveedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="AgroPro S.A." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{insumo?.id ? "Guardar Cambios" : "Crear Insumo"}</Button>
        </div>
      </form>
    </Form>
  );
});

InsumoForm.displayName = 'InsumoForm';

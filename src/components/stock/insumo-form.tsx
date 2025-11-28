
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
  unidad: z.enum(['kg', 'lt', 'unidad']),
  dosisRecomendada: z.coerce.number().optional(),
  costoUnitario: z.coerce.number().positive("El costo debe ser un número positivo."),
  stockActual: z.coerce.number().min(0, "El stock no puede ser negativo.").describe("Este es el stock inicial o de entrada."),
  stockMinimo: z.coerce.number().min(0, "El stock mínimo no puede ser negativo."),
  proveedor: z.string().optional(),
});

type InsumoFormValues = z.infer<typeof formSchema>;

interface InsumoFormProps {
  insumo?: Insumo | null;
  onSubmit: (data: Insumo) => void;
  onCancel: () => void;
}

export const InsumoForm = React.memo(({ insumo, onSubmit, onCancel }: InsumoFormProps) => {
  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: insumo || {
      nombre: "",
      categoria: "otros",
      principioActivo: "",
      unidad: "unidad",
      dosisRecomendada: 0,
      costoUnitario: 0,
      stockActual: 0,
      stockMinimo: 0,
      proveedor: "",
    },
  });

  const handleSubmit = (data: InsumoFormValues) => {
    onSubmit({
      id: insumo?.id || "",
      ...data,
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
              name="stockActual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Inicial / Entrada Total</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
        </div>
        
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="costoUnitario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo Unitario / Precio Promedio ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.8" {...field} />
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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{insumo ? "Guardar Cambios" : "Crear Insumo"}</Button>
        </div>
      </form>
    </Form>
  );
});

InsumoForm.displayName = 'InsumoForm';

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Zafra, Cultivo } from "@/lib/types";
import { format } from "date-fns";
import React from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

const formSchema = z.object({
  nombre: z.string().min(5, "El nombre debe tener al menos 5 caracteres."),
  cultivoId: z.string().optional(),
  fechaInicio: z.date({ required_error: "La fecha de inicio es obligatoria." }),
  fechaSiembra: z.date().optional(),
  estado: z.enum(["planificada", "en curso", "finalizada"]),
});

type ZafraFormValues = z.infer<typeof formSchema>;

interface ZafraFormProps {
  zafra?: Partial<Zafra> | null;
  onSubmit: (data: ZafraFormValues) => void;
  onCancel: () => void;
}

function dateToInputValue(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const ZafraForm = React.memo(({ zafra, onSubmit, onCancel }: ZafraFormProps) => {
  const firestore = useFirestore();
  const cultivosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "cultivos"), orderBy("nombre"));
  }, [firestore]);
  const { data: cultivos } = useCollection<Cultivo>(cultivosQuery);

  const form = useForm<ZafraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: zafra?.nombre || "",
      cultivoId: zafra?.cultivoId || "",
      fechaInicio: zafra?.fechaInicio ? new Date(zafra.fechaInicio as string) : new Date(),
      fechaSiembra: zafra?.fechaSiembra ? new Date(zafra.fechaSiembra as string) : undefined,
      estado: zafra?.estado || "planificada",
    },
  });

  const handleSubmit = (data: ZafraFormValues) => {
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
                <FormLabel>Nombre de la Zafra/Campana</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Soja Temprana - Lote 1 - 24/25" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cultivoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cultivo Asociado (Opcional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un cultivo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cultivos?.map((cultivo) => (
                      <SelectItem key={cultivo.id} value={cultivo.id}>
                        {cultivo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Asociar un cultivo ayuda a organizar y filtrar los analisis.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="fechaInicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Inicio</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(e) => field.onChange(inputValueToDate(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fechaSiembra"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Siembra (Opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(e) => field.onChange(inputValueToDate(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Fecha real de siembra para el panel agronomico.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="planificada">Planificada</SelectItem>
                    <SelectItem value="en curso">En Curso</SelectItem>
                    <SelectItem value="finalizada">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{zafra?.id ? "Guardar Cambios" : "Crear Zafra"}</Button>
        </div>
      </form>
    </Form>
  );
});

ZafraForm.displayName = "ZafraForm";

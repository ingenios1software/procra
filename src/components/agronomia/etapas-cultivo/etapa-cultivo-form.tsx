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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EtapaCultivo, Cultivo } from "@/lib/types";

const formSchema = z.object({
  cultivoId: z.string().min(1, "Debe seleccionar un cultivo."),
  nombre: z.string().min(1, "El código de la etapa es requerido."),
  descripcion: z.string().min(3, "La descripción es muy corta."),
  orden: z.coerce.number().min(1, "El orden debe ser un número positivo."),
});

type EtapaCultivoFormValues = z.infer<typeof formSchema>;

interface EtapaCultivoFormProps {
  etapa?: EtapaCultivo | null;
  cultivos: Cultivo[];
  onSubmit: (data: Omit<EtapaCultivo, "id">) => void;
  onCancel: () => void;
}

export function EtapaCultivoForm({
  etapa,
  cultivos,
  onSubmit,
  onCancel,
}: EtapaCultivoFormProps) {
  const form = useForm<EtapaCultivoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cultivoId: etapa?.cultivoId || "",
      nombre: etapa?.nombre || "",
      descripcion: etapa?.descripcion || "",
      orden: etapa?.orden || 1,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="cultivoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cultivo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un cultivo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cultivos.map((cultivo) => (
                    <SelectItem key={cultivo.id} value={cultivo.id}>
                      {cultivo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="orden"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orden</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de Etapa</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: V1, R1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción de la Etapa</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descripción de la etapa, características visuales, etc."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {etapa ? "Guardar Cambios" : "Crear Etapa"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

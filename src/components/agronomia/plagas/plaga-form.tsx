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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { Plaga, Cultivo } from "@/lib/types";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre es muy corto."),
  descripcion: z.string().optional(),
  cultivosAfectados: z
    .array(z.string())
    .refine((value) => value.some((item) => item), {
      message: "Debe seleccionar al menos un cultivo.",
    }),
});

type PlagaFormValues = z.infer<typeof formSchema>;

interface PlagaFormProps {
  plaga?: Partial<Plaga> | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function PlagaForm({
  plaga,
  onSubmit,
  onCancel,
}: PlagaFormProps) {
  const tenant = useTenantFirestore();
  const cultivosQuery = useMemoFirebase(() => tenant.query("cultivos", orderBy("nombre")), [tenant]);
  const { data: cultivos } = useCollection<Cultivo>(cultivosQuery);
  
  const form = useForm<PlagaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: plaga?.nombre || "",
      descripcion: plaga?.descripcion || "",
      cultivosAfectados: plaga?.cultivosAfectados || [],
    },
  });

  const handleSubmit = (data: PlagaFormValues) => {
    onSubmit(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Plaga</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Roya de la Soja" {...field} />
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
                <Textarea
                  placeholder="Descripción de la plaga, síntomas, etc."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cultivosAfectados"
          render={({ field }) => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Cultivos Afectados</FormLabel>
                <FormDescription>
                  Seleccione los cultivos que son comúnmente afectados por esta plaga.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cultivos?.map((cultivo) => (
                  <FormField
                    key={cultivo.id}
                    control={form.control}
                    name="cultivosAfectados"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={cultivo.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(cultivo.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      cultivo.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== cultivo.id
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {cultivo.nombre}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {plaga?.id ? "Guardar Cambios" : "Crear Plaga"}
          </Button>
        </div>
      </form>
    </Form>
  );
}


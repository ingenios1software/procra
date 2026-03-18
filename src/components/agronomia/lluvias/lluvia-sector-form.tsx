"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
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
import type { Parcela, RegistroLluviaSector, Zafra } from "@/lib/types";
import {
  getSectoresDisponibles,
  normalizeSectorName,
} from "@/lib/lluvias";

const formSchema = z.object({
  zafraId: z.string().min(1, "Debe seleccionar una zafra."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  sector: z.string().min(1, "Debe indicar un sector."),
  milimetros: z.coerce.number().positive("Los milimetros deben ser mayores a cero."),
  observacion: z.string().optional(),
});

type LluviaSectorFormValues = z.infer<typeof formSchema>;

interface LluviaSectorFormProps {
  registro?: Partial<RegistroLluviaSector> | null;
  parcelas: Parcela[];
  zafras: Zafra[];
  onSubmit: (data: LluviaSectorFormValues) => void;
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

export function LluviaSectorForm({
  registro,
  parcelas,
  zafras,
  onSubmit,
  onCancel,
}: LluviaSectorFormProps) {
  const form = useForm<LluviaSectorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      zafraId: registro?.zafraId || "",
      fecha: registro?.fecha ? new Date(registro.fecha as string) : new Date(),
      sector: registro?.sector || "",
      milimetros: Number(registro?.milimetros || 0) || 0,
      observacion: registro?.observacion || "",
    },
  });

  const watchedSector = form.watch("sector");
  const sectoresDisponibles = useMemo(() => getSectoresDisponibles(parcelas), [parcelas]);

  const parcelasImpactadas = useMemo(() => {
    const sectorNormalizado = normalizeSectorName(watchedSector);
    if (!sectorNormalizado) return [];

    return parcelas.filter(
      (parcela) => normalizeSectorName(parcela.sector) === sectorNormalizado
    );
  }, [parcelas, watchedSector]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="zafraId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zafra</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una zafra" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {zafras.map((zafra) => (
                      <SelectItem key={zafra.id} value={zafra.id}>
                        {zafra.nombre}
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
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(event) => field.onChange(inputValueToDate(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sector</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    list="sectores-lluvia"
                    placeholder="Ej: Norte"
                    autoComplete="off"
                  />
                </FormControl>
                <datalist id="sectores-lluvia">
                  {sectoresDisponibles.map((sector) => (
                    <option key={sector} value={sector} />
                  ))}
                </datalist>
                <FormDescription>
                  La lluvia se distribuirá a todas las parcelas que pertenezcan a este sector.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="milimetros"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Milimetros de lluvia</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="Ej: 32.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            Parcelas impactadas: {parcelasImpactadas.length}
          </p>
          <p className="text-muted-foreground">
            {parcelasImpactadas.length > 0
              ? parcelasImpactadas.map((parcela) => parcela.nombre).join(", ")
              : "No hay parcelas asociadas a ese sector todavia."}
          </p>
        </div>

        <FormField
          control={form.control}
          name="observacion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observacion</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Lluvia general despues de la siembra"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {registro?.id ? "Guardar Cambios" : "Registrar Lluvia"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

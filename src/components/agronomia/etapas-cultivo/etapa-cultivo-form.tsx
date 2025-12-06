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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  cultivoId: z.string().min(1, "Debe seleccionar un cultivo."),
  nombre: z.string().min(1, "El código de la etapa es requerido."),
  descripcion: z.string().min(3, "La descripción es muy corta."),
  orden: z.coerce.number().min(1, "El orden debe ser un número positivo."),
  diasDesdeSiembraInicio: z.coerce.number().min(0, "Los días deben ser un número positivo."),
  diasDesdeSiembraFin: z.coerce.number().min(0, "Los días deben ser un número positivo."),
});

type EtapaCultivoFormValues = z.infer<typeof formSchema>;

interface EtapaCultivoFormProps {
  etapa?: Partial<EtapaCultivo> | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const plantillasSoja = [
    { orden: 1, nombre: "VE", descripcion: "Emergencia, cotiledones desplegados", diasInicio: 0, diasFin: 5 },
    { orden: 2, nombre: "VC", descripcion: "Hojas unifoliadas desplegadas", diasInicio: 6, diasFin: 10 },
    { orden: 3, nombre: "V1", descripcion: "Primer nudo, una hoja trifoliada", diasInicio: 11, diasFin: 15 },
    { orden: 4, nombre: "V2", descripcion: "Segundo nudo, dos hojas trifoliadas", diasInicio: 16, diasFin: 20 },
    { orden: 5, nombre: "V3", descripcion: "Tercer nudo, tres hojas trifoliadas", diasInicio: 21, diasFin: 25 },
    { orden: 6, nombre: "R1", descripcion: "Inicio de floración", diasInicio: 26, diasFin: 35 },
    { orden: 7, nombre: "R2", descripcion: "Plena floración", diasInicio: 36, diasFin: 45 },
    { orden: 8, nombre: "R3", descripcion: "Inicio de formación de vainas", diasInicio: 46, diasFin: 55 },
    { orden: 9, nombre: "R4", descripcion: "Plena formación de vainas", diasInicio: 56, diasFin: 65 },
    { orden: 10, nombre: "R5", descripcion: "Inicio de llenado de granos", diasInicio: 66, diasFin: 80 },
    { orden: 11, nombre: "R6", descripcion: "Pleno llenado de granos", diasInicio: 81, diasFin: 95 },
    { orden: 12, nombre: "R7", descripcion: "Inicio de madurez", diasInicio: 96, diasFin: 110 },
    { orden: 13, nombre: "R8", descripcion: "Madurez plena", diasInicio: 111, diasFin: 120 },
];

export function EtapaCultivoForm({
  etapa,
  onSubmit,
  onCancel,
}: EtapaCultivoFormProps) {
  const firestore = useFirestore();
  const cultivosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cultivos'), orderBy('nombre'));
  }, [firestore]);
  const { data: cultivos } = useCollection<Cultivo>(cultivosQuery);
  
  const form = useForm<EtapaCultivoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cultivoId: etapa?.cultivoId || "",
      nombre: etapa?.nombre || "",
      descripcion: etapa?.descripcion || "",
      orden: etapa?.orden || 1,
      diasDesdeSiembraInicio: etapa?.diasDesdeSiembraInicio || 0,
      diasDesdeSiembraFin: etapa?.diasDesdeSiembraFin || 0,
    },
  });

  const selectedCultivoId = form.watch("cultivoId");
  
  const mostrarPlantillas = useMemo(() => {
    if(!selectedCultivoId) return false;
    const cultivo = cultivos?.find(c => c.id === selectedCultivoId);
    return cultivo?.nombre.toLowerCase().includes('soja');
  }, [selectedCultivoId, cultivos]);

  const handlePlantillaClick = (plantilla: typeof plantillasSoja[0]) => {
    form.setValue("orden", plantilla.orden);
    form.setValue("nombre", plantilla.nombre);
    form.setValue("descripcion", plantilla.descripcion);
    form.setValue("diasDesdeSiembraInicio", plantilla.diasInicio);
    form.setValue("diasDesdeSiembraFin", plantilla.diasFin);
  }

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
                  {cultivos?.map((cultivo) => (
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
        
        {mostrarPlantillas && (
            <div>
                <FormLabel>Plantillas para Soja</FormLabel>
                <div className="flex flex-wrap gap-2 mt-2">
                    {plantillasSoja.map(p => (
                        <Badge 
                            key={p.nombre} 
                            variant="outline"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => handlePlantillaClick(p)}
                        >
                            {p.nombre}
                        </Badge>
                    ))}
                </div>
            </div>
        )}

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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="diasDesdeSiembraInicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Días Inicio</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="diasDesdeSiembraFin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Días Fin</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="15" {...field} />
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
          <Button type="submit">
            {etapa?.id ? "Guardar Cambios" : "Crear Etapa"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

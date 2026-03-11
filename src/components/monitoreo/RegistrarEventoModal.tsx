"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, writeBatch } from "firebase/firestore";
import { X } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InsumoSelector } from "@/components/insumos/InsumoSelector";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import type { Cultivo, Parcela, Zafra } from "@/lib/types";

const formSchema = z.object({
  parcelaId: z.string().nonempty("La parcela es obligatoria."),
  tipo: z.enum(["aplicacion", "fertilizacion", "monitoreo", "siembra", "labores", "cosecha"]),
  fecha: z.date(),
  observacion: z.string().optional(),
  insumos: z
    .array(
      z.object({
        insumo: z.any(),
        dosis: z.coerce.number().positive(),
      })
    )
    .optional(),
  hectareas: z.coerce.number().optional(),
  plaga: z.string().optional(),
  gradoInfestacion: z.enum(["bajo", "medio", "alto"]).optional(),
  variedad: z.string().optional(),
  densidad: z.coerce.number().optional(),
  tipoLabor: z.string().optional(),
  horasTrabajo: z.coerce.number().optional(),
  rindeEsperado: z.coerce.number().optional(),
  rindeReal: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RegistrarEventoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventSaved: () => void;
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
}

export function RegistrarEventoModal({
  isOpen,
  onClose,
  onEventSaved,
  parcelas,
  zafras,
  cultivos,
}: RegistrarEventoModalProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const tenant = useTenantFirestore();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha: new Date(),
      tipo: "aplicacion",
      insumos: [],
      observacion: "",
      hectareas: "" as any,
      plaga: "",
      variedad: "",
      densidad: "" as any,
      tipoLabor: "",
      horasTrabajo: "" as any,
      rindeEsperado: "" as any,
      rindeReal: "" as any,
    },
  });

  const tipoEvento = form.watch("tipo");
  const selectedParcelaId = form.watch("parcelaId");
  const selectedParcela = useMemo(
    () => parcelas.find((parcela) => parcela.id === selectedParcelaId),
    [parcelas, selectedParcelaId]
  );

  useEffect(() => {
    if (selectedParcela) {
      form.setValue("hectareas", selectedParcela.superficie);
    }
  }, [form, selectedParcela]);

  const renderDynamicFields = () => {
    switch (tipoEvento) {
      case "aplicacion":
      case "fertilizacion":
        return (
          <>
            <FormField
              control={form.control}
              name="hectareas"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel>Hectareas</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className="px-4 py-3 text-base sm:text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm font-medium lg:col-span-2">Insumos</p>
            <FormField
              control={form.control}
              name="insumos.0.insumo"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel>Insumo</FormLabel>
                  <InsumoSelector value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insumos.0.dosis"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel>Dosis por Hectarea</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className="px-4 py-3 text-base sm:text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      case "monitoreo":
        return (
          <>
            <FormField
              control={form.control}
              name="plaga"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel>Plaga/Enfermedad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Roya asiatica" {...field} className="px-4 py-3 text-base sm:text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gradoInfestacion"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel>Grado de Infestacion</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-auto px-4 py-3 text-base sm:text-sm">
                        <SelectValue placeholder="Seleccione un nivel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bajo">Bajo</SelectItem>
                      <SelectItem value="medio">Medio</SelectItem>
                      <SelectItem value="alto">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!firestore || !user || !selectedParcela) return;

    const zafraActiva = zafras.find((zafra) => zafra.estado === "en curso");
    if (!zafraActiva) {
      toast({
        variant: "destructive",
        title: "No hay zafra activa",
        description: "Por favor, active una zafra para registrar eventos.",
      });
      return;
    }

    const batch = writeBatch(firestore);
    const eventosCol = tenant.collection("eventos");
    if (!eventosCol) return;

    const eventoRef = doc(eventosCol);
    const eventoData = {
      ...data,
      fecha: data.fecha,
      parcelaId: selectedParcela.id,
      parcelaNombre: selectedParcela.nombre,
      zafraId: zafraActiva.id,
      cultivo: cultivos.find((cultivo) => cultivo.id === zafraActiva.cultivoId)?.nombre || "N/A",
      tecnico: user.displayName || user.email,
      datosExtras: {},
      fotos: [],
    };
    batch.set(eventoRef, eventoData);

    if (data.insumos && data.hectareas) {
      data.insumos.forEach((item) => {
        if (!item.insumo || !item.insumo.id) return;
        const consumoTotal = item.dosis * (data.hectareas || 0);
        const insumoRef = tenant.doc("insumos", item.insumo.id);
        if (!insumoRef) return;
        const stockActual = item.insumo.stockActual || 0;
        batch.update(insumoRef, { stockActual: stockActual - consumoTotal });
      });
    }

    try {
      await batch.commit();
      toast({ title: "Evento registrado con exito" });
      onEventSaved();
    } catch (error) {
      console.error("Error al guardar evento:", error);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudo registrar el evento.",
      });
    }
  };

  return (
    <Dialog modal={false} open={isOpen} onOpenChange={onClose}>
      <DialogContent
        draggable
        className="h-screen max-h-screen w-screen max-w-full rounded-none p-0 sm:h-auto sm:max-h-[94vh] sm:w-[min(96vw,1100px)] sm:max-w-[96vw] sm:rounded-lg lg:w-[min(96vw,1280px)]"
      >
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3 sm:p-6 sm:text-left">
          <div>
            <DialogTitle className="text-lg">Registrar Nuevo Evento</DialogTitle>
            <DialogDescription className="hidden sm:block">
              Complete los detalles de la actividad de campo.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 sm:h-8 sm:w-8">
            <X className="h-6 w-6 sm:h-4 sm:w-4" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </DialogHeader>

        <ScrollArea className="flex-grow">
          <div className="p-4 sm:p-6">
            <Form {...form}>
              <form
                id="evento-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-5 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5"
              >
                <FormField
                  control={form.control}
                  name="parcelaId"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-1">
                      <FormLabel>Parcela</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-auto px-4 py-3 text-base sm:text-sm">
                            <SelectValue placeholder="Seleccione una parcela" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parcelas.map((parcela) => (
                            <SelectItem key={parcela.id} value={parcela.id}>
                              {parcela.nombre}
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
                  name="tipo"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-1">
                      <FormLabel>Tipo de Evento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-auto px-4 py-3 text-base sm:text-sm">
                            <SelectValue placeholder="Seleccione un tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aplicacion">Aplicacion</SelectItem>
                          <SelectItem value="fertilizacion">Fertilizacion</SelectItem>
                          <SelectItem value="monitoreo">Monitoreo</SelectItem>
                          <SelectItem value="siembra">Siembra</SelectItem>
                          <SelectItem value="labores">Labores</SelectItem>
                          <SelectItem value="cosecha">Cosecha</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {renderDynamicFields()}

                <FormField
                  control={form.control}
                  name="observacion"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-2">
                      <FormLabel>Observaciones</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalles adicionales..."
                          {...field}
                          className="min-h-32 text-base sm:text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t p-4 sm:p-6">
          <Button variant="outline" onClick={onClose} className="h-12 w-full text-base sm:h-10 sm:w-auto sm:text-sm">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="evento-form"
            className="h-12 w-full text-lg font-bold sm:h-10 sm:w-auto sm:text-sm sm:font-medium"
          >
            Guardar Evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

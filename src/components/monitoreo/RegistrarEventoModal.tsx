"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, writeBatch } from 'firebase/firestore';
import { InsumoSelector } from '../insumos/InsumoSelector';
import type { Parcela, Zafra, Cultivo, Insumo } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';

const formSchema = z.object({
  parcelaId: z.string().nonempty("La parcela es obligatoria."),
  tipo: z.enum(['aplicacion', 'fertilizacion', 'monitoreo', 'siembra', 'labores', 'cosecha']),
  fecha: z.date(),
  observacion: z.string().optional(),
  
  // Campos dinámicos
  insumos: z.array(z.object({
    insumo: z.any(),
    dosis: z.coerce.number().positive(),
  })).optional(),
  hectareas: z.coerce.number().optional(),

  plaga: z.string().optional(),
  gradoInfestacion: z.enum(['bajo', 'medio', 'alto']).optional(),

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

export function RegistrarEventoModal({ isOpen, onClose, onEventSaved, parcelas, zafras, cultivos }: RegistrarEventoModalProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha: new Date(),
      tipo: 'aplicacion',
      insumos: [],
      observacion: '',
      hectareas: 0,
      plaga: '',
      variedad: '',
      densidad: 0,
      tipoLabor: '',
      horasTrabajo: 0,
      rindeEsperado: 0,
      rindeReal: 0,
    },
  });

  const tipoEvento = form.watch('tipo');
  const selectedParcelaId = form.watch('parcelaId');
  
  const selectedParcela = useMemo(() => parcelas.find(p => p.id === selectedParcelaId), [parcelas, selectedParcelaId]);

  useEffect(() => {
    if (selectedParcela) {
      form.setValue('hectareas', selectedParcela.superficie);
    }
  }, [selectedParcela, form]);


  const renderDynamicFields = () => {
    switch (tipoEvento) {
      case 'aplicacion':
      case 'fertilizacion':
        return (
          <>
            {/* Aquí iría el selector de insumos múltiples */}
            <FormField
              control={form.control}
              name="hectareas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hectáreas</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <p className="text-sm font-medium">Insumos</p>
            {/* Simplificado por ahora, idealmente usaríamos useFieldArray */}
             <FormField
                control={form.control}
                name="insumos.0.insumo"
                render={({ field }) => (
                    <FormItem>
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
                    <FormItem>
                        <FormLabel>Dosis por Hectárea</FormLabel>
                        <FormControl><Input type="number" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </>
        );
      case 'monitoreo':
        return (
          <>
            <FormField control={form.control} name="plaga" render={({ field }) => ( <FormItem> <FormLabel>Plaga/Enfermedad</FormLabel> <FormControl><Input placeholder="Ej: Roya asiática" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="gradoInfestacion" render={({ field }) => ( <FormItem> <FormLabel>Grado de Infestación</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un nivel" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="bajo">Bajo</SelectItem> <SelectItem value="medio">Medio</SelectItem> <SelectItem value="alto">Alto</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )}/>
          </>
        );
      // ... otros casos
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!firestore || !user || !selectedParcela) return;

    const zafraActiva = zafras.find(z => z.estado === 'en curso'); // Simplificación
    if(!zafraActiva) {
      toast({ variant: "destructive", title: "No hay zafra activa", description: "Por favor, active una zafra para registrar eventos." });
      return;
    }

    const batch = writeBatch(firestore);

    // 1. Crear el documento del evento
    const eventoRef = doc(collection(firestore, "eventos"));
    const eventoData = {
      ...data,
      fecha: data.fecha,
      parcelaId: selectedParcela.id,
      parcelaNombre: selectedParcela.nombre,
      zafraId: zafraActiva.id,
      cultivo: cultivos.find(c => c.id === zafraActiva.cultivoId)?.nombre || 'N/A',
      tecnico: user.displayName || user.email,
      datosExtras: {}, // Llenar según el tipo
      fotos: [] // Lógica de subida de fotos pendiente
    };
    batch.set(eventoRef, eventoData);

    // 2. Actualizar stock de insumos
    if (data.insumos && data.hectareas) {
      data.insumos.forEach(item => {
        if (!item.insumo || !item.insumo.id) return;
        const consumoTotal = item.dosis * (data.hectareas || 0);
        const insumoRef = doc(firestore, "insumos", item.insumo.id);
        // OJO: Esta no es una operación atómica. Idealmente se usaría una transacción o Cloud Function.
        // Para este MVP, lo hacemos así. El stock actual vendría del objeto 'insumo'.
        const stockActual = item.insumo.stockActual || 0;
        batch.update(insumoRef, { stockActual: stockActual - consumoTotal });
      });
    }

    try {
      await batch.commit();
      toast({ title: "Evento registrado con éxito" });
      onEventSaved();
    } catch (error) {
      console.error("Error al guardar evento:", error);
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo registrar el evento." });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] md:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Evento</DialogTitle>
          <DialogDescription>Complete los detalles de la actividad de campo.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
            <Form {...form}>
              <form id="evento-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="parcelaId" render={({ field }) => ( <FormItem> <FormLabel>Parcela</FormLabel> <Select onValueChange={field.onChange} value={field.value || ''}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una parcela" /></SelectTrigger></FormControl> <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem> <FormLabel>Tipo de Evento</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="aplicacion">Aplicación</SelectItem> <SelectItem value="fertilizacion">Fertilización</SelectItem> <SelectItem value="monitoreo">Monitoreo</SelectItem> <SelectItem value="siembra">Siembra</SelectItem> <SelectItem value="labores">Labores</SelectItem> <SelectItem value="cosecha">Cosecha</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                
                {renderDynamicFields()}
                
                <FormField control={form.control} name="observacion" render={({ field }) => ( <FormItem> <FormLabel>Observaciones</FormLabel> <FormControl><Textarea placeholder="Detalles adicionales..." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </form>
            </Form>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="evento-form">Guardar Evento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

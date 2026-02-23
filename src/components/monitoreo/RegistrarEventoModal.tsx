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
import { X } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

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
      hectareas: '' as any, // Inicializar como string vacío para evitar error de uncontrolled
      plaga: '',
      variedad: '',
      densidad: '' as any,
      tipoLabor: '',
      horasTrabajo: '' as any,
      rindeEsperado: '' as any,
      rindeReal: '' as any,
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
            <FormField
              control={form.control}
              name="hectareas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hectáreas</FormLabel>
                  <FormControl><Input type="number" {...field} className="py-3 px-4 text-base sm:text-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm font-medium">Insumos</p>
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
                        <FormControl><Input type="number" className="py-3 px-4 text-base sm:text-sm"/></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </>
        );
      case 'monitoreo':
        return (
          <>
            <FormField control={form.control} name="plaga" render={({ field }) => ( <FormItem> <FormLabel>Plaga/Enfermedad</FormLabel> <FormControl><Input placeholder="Ej: Roya asiática" {...field} className="py-3 px-4 text-base sm:text-sm" /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="gradoInfestacion" render={({ field }) => ( <FormItem> <FormLabel>Grado de Infestación</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger className="py-3 px-4 text-base sm:text-sm h-auto"><SelectValue placeholder="Seleccione un nivel" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="bajo">Bajo</SelectItem> <SelectItem value="medio">Medio</SelectItem> <SelectItem value="alto">Alto</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )}/>
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
      <DialogContent className="h-screen max-h-screen w-screen max-w-full rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-2xl sm:rounded-lg">
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3 sm:text-left sm:p-6">
          <div>
            <DialogTitle className="text-lg">Registrar Nuevo Evento</DialogTitle>
            <DialogDescription className="hidden sm:block">Complete los detalles de la actividad de campo.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 sm:h-8 sm:w-8">
            <X className="h-6 w-6 sm:h-4 sm:w-4"/>
            <span className="sr-only">Cerrar</span>
          </Button>
        </DialogHeader>
        <ScrollArea className="flex-grow">
            <div className="p-4 sm:p-6">
                <Form {...form}>
                  <form id="evento-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="parcelaId" render={({ field }) => ( <FormItem> <FormLabel>Parcela</FormLabel> <Select onValueChange={field.onChange} value={field.value || ''}> <FormControl><SelectTrigger className="py-3 px-4 text-base sm:text-sm h-auto"><SelectValue placeholder="Seleccione una parcela" /></SelectTrigger></FormControl> <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem> <FormLabel>Tipo de Evento</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger className="py-3 px-4 text-base sm:text-sm h-auto"><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="aplicacion">Aplicación</SelectItem> <SelectItem value="fertilizacion">Fertilización</SelectItem> <SelectItem value="monitoreo">Monitoreo</SelectItem> <SelectItem value="siembra">Siembra</SelectItem> <SelectItem value="labores">Labores</SelectItem> <SelectItem value="cosecha">Cosecha</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                    
                    {renderDynamicFields()}
                    
                    <FormField control={form.control} name="observacion" render={({ field }) => ( <FormItem> <FormLabel>Observaciones</FormLabel> <FormControl><Textarea placeholder="Detalles adicionales..." {...field} className="text-base sm:text-sm" /></FormControl> <FormMessage /> </FormItem> )} />
                  </form>
                </Form>
            </div>
        </ScrollArea>
        <DialogFooter className="border-t p-4 sm:p-6">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-12 text-base sm:h-10 sm:text-sm">Cancelar</Button>
          <Button type="submit" form="evento-form" className="w-full sm:w-auto h-12 text-lg font-bold sm:h-10 sm:text-sm sm:font-medium">Guardar Evento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

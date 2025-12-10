"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Evento, Insumo, Parcela, Cultivo, Zafra, EtapaCultivo, EventoBorrador, Foto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon, Cloud, Thermometer, Wind, DollarSign, Eraser, Check, Ban, Clock } from "lucide-react";
import { format } from "date-fns";
import { EventoAnalisisPanel } from "./evento-analisis-panel";
import { useMemo, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { useDraftStore } from "@/store/draft-store";
import isEqual from 'lodash.isequal';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { ImageUpload } from "./ImageUpload";
import { InsumosTabla } from "./InsumosTabla";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { SelectorUniversal } from "../common";
import { SelectorPlanDeCuentas } from "../contabilidad/SelectorPlanDeCuentas";


const productoSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo válido." }),
  dosis: z.coerce.number().positive("La dosis debe ser mayor a 0."),
});

const fotoSchema = z.object({
  url: z.string(),
  storagePath: z.string(),
});

const formSchema = z.object({
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  tipo: z.enum(['siembra', 'fertilización', 'riego', 'cosecha', 'mantenimiento', 'plagas', 'aplicacion', 'rendimiento']),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  descripcion: z.string().min(5, "La descripción es muy corta."),
  
  hectareasAplicadas: z.coerce.number().optional(),
  costoServicioPorHa: z.coerce.number().optional(),

  productos: z.array(productoSchema).optional(),
  fotos: z.array(fotoSchema).optional(),

  temperatura: z.coerce.number().optional(),
  humedad: z.coerce.number().optional(),
  viento: z.coerce.number().optional(),

  resultado: z.string().optional(),
  
  toneladas: z.coerce.number().optional(),
  precioTonelada: z.coerce.number().optional(),
  
  // Workflow
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
  motivoRechazo: z.string().optional(),

  cuentaContableId: z.string().nullable().optional(),
});

type EventoFormValues = z.infer<typeof formSchema>;

interface EventoFormProps {
  evento?: Evento | null;
  onSave: (data: Omit<Evento, 'id'>) => void;
  onCancel: () => void;
}

export function EventoForm({ evento, onSave, onCancel }: EventoFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { role } = useAuth();
  const { draft, setDraft, clearDraft } = useDraftStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const { data: parcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? collection(firestore, 'parcelas') : null, [firestore]));
  const { data: cultivos } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'cultivos') : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));
  const { data: todosLosEventos } = useCollection<Evento>(useMemoFirebase(() => firestore ? collection(firestore, 'eventos') : null, [firestore]));
  const { data: etapasCultivo } = useCollection<EtapaCultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'etapasCultivo') : null, [firestore]));
  
  const getInitialValues = () => {
    // Si estamos editando un evento existente, usamos sus datos.
    if (evento) {
      return {
        ...evento,
        fecha: new Date(evento.fecha as string),
        hectareasAplicadas: evento.hectareasAplicadas ?? '',
        costoServicioPorHa: evento.costoServicioPorHa ?? '',
        temperatura: evento.temperatura ?? '',
        humedad: evento.humedad ?? '',
        viento: evento.viento ?? '',
        toneladas: evento.toneladas ?? '',
        precioTonelada: evento.precioTonelada ?? '',
        resultado: evento.resultado ?? '',
        cuentaContableId: evento.cuentaContableId || null,
      };
    }
    // Si no hay evento y existe un borrador, usamos el borrador.
    if (draft && Object.keys(draft).length > 0) {
      return { 
        ...draft, 
        fecha: draft.fecha ? new Date(draft.fecha) : new Date() 
      };
    }
    // Si no hay nada, valores por defecto para un evento nuevo.
    return {
      fecha: new Date(),
      tipo: 'aplicacion',
      productos: [],
      fotos: [],
      descripcion: "",
      hectareasAplicadas: '' as any,
      costoServicioPorHa: '' as any,
      temperatura: '' as any,
      humedad: '' as any,
      viento: '' as any,
      toneladas: '' as any,
      precioTonelada: '' as any,
      resultado: '',
      cuentaContableId: null,
    };
  }

  const form = useForm<EventoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues() as any,
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "productos",
  });
  
  const watchedValues = form.watch();
  
  const puedeAprobar = role === 'admin' || role === 'supervisor';
  const isFinalizado = evento?.estado === 'aprobado' || evento?.estado === 'rechazado';


  useEffect(() => {
    // Cuando el `evento` que viene de las props cambia, reseteamos el formulario
    // con los valores correctos, sea un evento existente o un formulario nuevo/borrador.
    form.reset(getInitialValues() as any);
  }, [evento]);


  useEffect(() => {
    // Esta lógica de guardado de borrador solo se aplica si NO estamos editando un evento existente.
    if (evento) return;

    const intervalId = setInterval(() => {
        const currentValues = form.getValues();
        setDraft(currentValues as EventoBorrador);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [evento, form, setDraft]);


  const tipoEvento = form.watch('tipo');
  const watchedHectareas = form.watch('hectareasAplicadas');
  const watchedProductos = form.watch('productos');
  const watchedCostoServicio = form.watch('costoServicioPorHa');
  const watchedParcelaId = form.watch('parcelaId');
  const watchedZafraId = form.watch('zafraId');
  const watchedFecha = form.watch('fecha');
  
  const { totalInsumos, totalServicio, totalEvento, costoPorHa } = useMemo(() => {
    const costoProductos = watchedProductos?.reduce((acc, prod) => {
        if (!prod || !prod.insumo || !prod.dosis) {
            return acc;
        }
        const cantidad = (watchedHectareas || 0) * prod.dosis;
        const costoUnitario = prod.insumo.precioPromedioCalculado || prod.insumo.costoUnitario || 0;
        return acc + (cantidad * costoUnitario);
    }, 0) || 0;

    const costoServicio = (Number(watchedHectareas) || 0) * (Number(watchedCostoServicio) || 0);
    const costoTotal = costoProductos + costoServicio;
    const costoHa = (Number(watchedHectareas) > 0) ? costoTotal / Number(watchedHectareas) : 0;
    
    return {
      totalInsumos: costoProductos,
      totalServicio: costoServicio,
      totalEvento: costoTotal,
      costoPorHa: costoHa,
    };
  }, [watchedProductos, watchedHectareas, watchedCostoServicio]);

  const analisisProps = useMemo(() => ({
    eventoActual: { ...form.getValues(), fecha: watchedFecha, parcelaId: watchedParcelaId, zafraId: watchedZafraId } as Evento,
    todosLosEventos: todosLosEventos || [],
    zafras: zafras || [],
    etapasCultivo: etapasCultivo || [],
  }), [watchedParcelaId, watchedZafraId, watchedFecha, form, todosLosEventos, zafras, etapasCultivo]);


  const handleSubmit = async (data: EventoFormValues) => {
    if (!firestore || !user) return;
    
    setIsSubmitting(true);
    toast({ title: "Guardando evento...", description: "Por favor espere." });

    const productosFinal = data.productos?.map(p => {
        const consumoCalculado = (p.dosis || 0) * (data.hectareasAplicadas || 0);
        return {
            insumoId: p.insumo.id,
            dosis: p.dosis,
            cantidad: consumoCalculado,
        };
    });

    const dataConCostoTotal = {
      ...data,
      estado: data.estado || 'pendiente',
      fotos: data.fotos || [],
      costoTotal: totalEvento,
      costoPorHa: costoPorHa,
      productos: productosFinal,
    };
    onSave(dataConCostoTotal);
    clearDraft();
    setIsSubmitting(false);
  };

  const handleDiscard = () => {
    clearDraft();
    form.reset({
        fecha: new Date(),
        tipo: 'aplicacion',
        productos: [],
        fotos: [],
        descripcion: "",
        hectareasAplicadas: '' as any,
        costoServicioPorHa: '' as any,
        temperatura: '' as any,
        humedad: '' as any,
        viento: '' as any,
        toneladas: '' as any,
        precioTonelada: '' as any,
        resultado: '',
    });
    toast({
        title: 'Borrador descartado',
        description: 'El formulario se ha limpiado.',
    })
  }

  const handleApprove = () => {
    if (!firestore || !user || !evento) return;
    const eventoRef = doc(firestore, 'eventos', evento.id);
    updateDocumentNonBlocking(eventoRef, {
      estado: 'aprobado',
      aprobadoPor: user.uid,
      aprobadoEn: serverTimestamp(),
    });
    toast({ title: "Evento Aprobado", description: "El evento ha sido marcado como aprobado." });
    onCancel();
  }

  const handleReject = () => {
    if (!firestore || !user || !evento) return;
    const motivo = form.getValues('motivoRechazo');
    if (!motivo || motivo.trim().length < 5) {
      form.setError('motivoRechazo', { type: 'manual', message: 'Debe ingresar un motivo de al menos 5 caracteres.' });
      return;
    }
    const eventoRef = doc(firestore, 'eventos', evento.id);
    updateDocumentNonBlocking(eventoRef, {
      estado: 'rechazado',
      rechazadoPor: user.uid,
      rechazadoEn: serverTimestamp(),
      motivoRechazo: motivo,
    });
    toast({ title: "Evento Rechazado", variant: "destructive" });
    onCancel();
  };

  const handleFileAdd = (newFile: Foto) => {
    form.setValue('fotos', [...(form.getValues('fotos') || []), newFile], { shouldDirty: true });
  };

  const handleFileRemove = (storagePath: string) => {
    form.setValue('fotos', (form.getValues('fotos') || []).filter(f => f.storagePath !== storagePath), { shouldDirty: true });
  };


  if (!parcelas || !cultivos || !zafras || !etapasCultivo) {
    return <p>Cargando datos maestros...</p>;
  }

  return (
    <>
      <EventoAnalisisPanel {...analisisProps} />

      {evento?.estado === 'aprobado' && (
          <Card className="mb-6 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
              <CardHeader className="flex-row items-center gap-4 p-4">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400"/>
                  <div>
                      <CardTitle className="text-green-800 dark:text-green-300">Evento Aprobado</CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-400/80">
                          Este registro está cerrado y no puede ser modificado. Aprobado por <strong>{evento?.aprobadoPor || 'N/A'}</strong> el {evento?.aprobadoEn ? format(new Date((evento.aprobadoEn as any).seconds * 1000), 'dd/MM/yyyy HH:mm') : 'N/A'}.
                      </CardDescription>
                  </div>
              </CardHeader>
          </Card>
      )}

      {evento?.estado === 'rechazado' && (
           <Card className="mb-6 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700">
               <CardHeader className="flex-row items-center gap-4 p-4">
                  <Ban className="w-6 h-6 text-red-600 dark:text-red-400"/>
                  <div>
                      <CardTitle className="text-red-800 dark:text-red-300">Evento Rechazado</CardTitle>
                      <CardDescription className="text-red-700 dark:text-red-400/80">
                          Motivo: <strong>{evento.motivoRechazo}</strong>.
                      </CardDescription>
                  </div>
              </CardHeader>
           </Card>
      )}

      <Card>
        <CardContent className="p-6 mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <fieldset disabled={isFinalizado}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="parcelaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcela</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Parcela>
                            collectionName="parcelas"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={parcelas?.find(p => p.id === field.value)}
                            onSelect={(p) => field.onChange(p?.id)}
                            searchFields={['nombre', 'codigo', 'numeroItem']}
                            extraInfoFields={[
                              { label: 'Sup.', field: 'superficie', format: (val) => `${val} ha` },
                              { label: 'Estado', field: 'estado' },
                            ]}
                          />
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
                        <FormLabel>Cultivo / Variedad</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Cultivo>
                            collectionName="cultivos"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={cultivos?.find(c => c.id === field.value)}
                            onSelect={(c) => field.onChange(c?.id)}
                            searchFields={['nombre', 'numeroItem']}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zafraId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zafra</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Zafra>
                            collectionName="zafras"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={zafras?.find(z => z.id === field.value)}
                            onSelect={(z) => field.onChange(z?.id)}
                            searchFields={['nombre', 'numeroItem']}
                            extraInfoFields={[
                              { label: 'Estado', field: 'estado'},
                              { label: 'Inicio', field: 'fechaInicio', format: (val) => format(new Date(val), 'dd/MM/yyyy') },
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField name="tipo" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Tipo de Evento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="siembra">Siembra</SelectItem><SelectItem value="aplicacion">Aplicación</SelectItem><SelectItem value="fertilización">Fertilización</SelectItem><SelectItem value="riego">Riego</SelectItem><SelectItem value="cosecha">Cosecha</SelectItem><SelectItem value="rendimiento">Rendimiento</SelectItem><SelectItem value="mantenimiento">Mantenimiento</SelectItem><SelectItem value="plagas">Control de Plagas</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha del Evento</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                </div>
                <FormField name="descripcion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Describa el evento..." {...field} /></FormControl><FormMessage /></FormItem> )} />

                <FormField
                  control={form.control}
                  name="cuentaContableId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta Contable de Costo (Opcional)</FormLabel>
                        <SelectorPlanDeCuentas
                            value={field.value}
                            onChange={field.onChange}
                            filter="gasto"
                        />
                      <FormDescription>Asocia este evento a una cuenta contable para el análisis de costos.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {['aplicacion', 'fertilización', 'plagas', 'siembra'].includes(tipoEvento) && (
                  <Card className="border-border/60">
                     <CardHeader className="p-4"><CardTitle className="text-lg">Detalles de Aplicación y Costos</CardTitle></CardHeader>
                     <CardContent className="p-4 pt-0 space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField name="hectareasAplicadas" control={form.control} render={({ field }) => (<FormItem><FormLabel>Hectáreas Aplicadas</FormLabel><FormControl><Input type="number" placeholder="Ej: 50" {...field} /></FormControl><FormMessage /></FormItem>)} />
                         <FormField name="costoServicioPorHa" control={form.control} render={({ field }) => (<FormItem><FormLabel>Costo de Servicio por Ha ($)</FormLabel><FormControl><Input type="number" placeholder="Ej: 15" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                     </CardContent>
                  </Card>
                )}

                {['aplicacion', 'fertilización', 'plagas', 'siembra'].includes(tipoEvento) && (
                  <Card className="bg-muted/30 p-4">
                    <CardHeader className="p-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Productos/Insumos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-4">
                       <InsumosTabla
                          fields={fields}
                          hectareas={watchedHectareas || 0}
                          append={append}
                          remove={remove}
                          form={form}
                       />
                    </CardContent>
                  </Card>
                )}

                 {['aplicacion', 'fertilización', 'plagas'].includes(tipoEvento) && (
                   <div>
                     <FormLabel>Condiciones Climáticas</FormLabel>
                     <div className="grid grid-cols-3 gap-4 mt-2 border p-4 rounded-md">
                        <FormField name="temperatura" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Temp (°C)</FormLabel><div className="relative"><Thermometer className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                        <FormField name="humedad" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Humedad (%)</FormLabel><div className="relative"><Cloud className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                        <FormField name="viento" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Viento (km/h)</FormLabel><div className="relative"><Wind className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                     </div>
                   </div>
                )}

                {['cosecha', 'riego'].includes(tipoEvento) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="toneladas" render={({ field }) => (<FormItem><FormLabel>Cantidad/Volumen</FormLabel><FormControl><Input type="number" placeholder="Ej: 100" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="precioTonelada" render={({ field }) => (<FormItem><FormLabel>Unidad</FormLabel><FormControl><Input placeholder="Ej: ton, mm, hs" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                )}

                {tipoEvento === 'rendimiento' && (
                  <Card className="bg-muted/30 p-4">
                    <CardHeader className="p-2"><CardTitle className="text-lg">Detalles de Rendimiento</CardTitle></CardHeader>
                    <CardContent className="p-2 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField name="toneladas" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Toneladas Cosechadas</FormLabel><FormControl><Input type="number" placeholder="Ej: 150" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField name="precioTonelada" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Precio por Tonelada (USD)</FormLabel><FormControl><Input type="number" placeholder="Ej: 450" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <FormField control={form.control} name="resultado" render={({ field }) => (<FormItem><FormLabel>Resultado/Observaciones</FormLabel><FormControl><Textarea placeholder="Observaciones sobre el resultado de la labor..." {...field} /></FormControl><FormMessage /></FormItem>)} />

                <ImageUpload
                  onFileAdd={handleFileAdd}
                  onFileRemove={handleFileRemove}
                  existingFiles={form.watch('fotos') || []}
                  eventoId={evento?.id || 'temp'}
                  parcelaId={watchedParcelaId}
                />
              </fieldset>

              <div className="flex justify-end pt-4 gap-4">
                <div className="flex items-center gap-4 mr-auto">
                    <div className="flex items-stretch gap-4">
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-background border border-primary/20">
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-sm text-muted-foreground">Valor Total de Ítems:</span>
                                <span className="font-mono font-semibold">${totalInsumos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-sm text-muted-foreground">Costo de Servicio:</span>
                                <span className="font-mono font-semibold">${totalServicio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t pt-2 mt-1">
                                <span className="text-lg font-bold text-primary">Costo Total del Evento:</span>
                                <span className="text-xl font-bold text-primary font-mono">${totalEvento.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <Card className="flex flex-col items-center justify-center p-4 bg-primary/5 border-primary/20">
                           <CardHeader className="p-0 text-center">
                               <p className="text-sm text-muted-foreground">Costo por Hectárea</p>
                           </CardHeader>
                           <CardContent className="p-0">
                                <p className="text-2xl font-bold text-green-700 dark:text-green-500 font-mono">${costoPorHa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                           </CardContent>
                        </Card>
                    </div>
                 </div>

                {draft && Object.keys(draft).length > 0 && !evento && (
                    <Button type="button" variant="ghost" onClick={handleDiscard} className="text-destructive hover:text-destructive">
                        <Eraser className="mr-2"/>
                        Descartar Borrador
                    </Button>
                )}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                    {!evento && <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Registrar Evento"}</Button>}
                </div>
              </div>
            </form>
          </Form>

          {evento && evento.estado === 'pendiente' && puedeAprobar && (
             <div className="mt-6 border-t pt-6">
                <div className="flex justify-end gap-4">
                    <AlertDialog open={isRejecting} onOpenChange={setIsRejecting}>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                              <Ban className="mr-2" />
                              Rechazar
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Rechazar Evento</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Por favor, ingrese el motivo del rechazo. Este será visible para el usuario que registró el evento.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Form {...form}>
                              <FormField
                                name="motivoRechazo"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Motivo del Rechazo</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Ej: La dosis aplicada no es la correcta para esta etapa..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                              />
                          </Form>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleReject}>Confirmar Rechazo</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button onClick={handleApprove}>
                        <Check className="mr-2" />
                        Aprobar Evento
                    </Button>
                </div>
             </div>
          )}

        </CardContent>
      </Card>
    </>
  );
}

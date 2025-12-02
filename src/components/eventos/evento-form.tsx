"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Evento, Insumo, Parcela, Cultivo, Zafra, EtapaCultivo, EventoBorrador, Compra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon, Cloud, Thermometer, Wind, PlusCircle, Trash2, DollarSign, Eraser } from "lucide-react";
import { format } from "date-fns";
import { EventoAnalisisPanel } from "./evento-analisis-panel";
import { useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import { useDraftStore } from "@/store/draft-store";
import isEqual from 'lodash.isequal';


const productoSchema = z.object({
  insumoId: z.string().nonempty("Debe seleccionar un insumo."),
  dosis: z.coerce.number().positive("La dosis debe ser mayor a 0."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
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

  temperatura: z.coerce.number().optional(),
  humedad: z.coerce.number().optional(),
  viento: z.coerce.number().optional(),

  resultado: z.string().optional(),
  
  toneladas: z.coerce.number().optional(),
  precioTonelada: z.coerce.number().optional(),
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
  const { draft, setDraft, clearDraft } = useDraftStore();

  const { data: parcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? collection(firestore, 'parcelas') : null, [firestore]));
  const { data: cultivos } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'cultivos') : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));
  const { data: todosLosEventos } = useCollection<Evento>(useMemoFirebase(() => firestore ? collection(firestore, 'eventos') : null, [firestore]));
  const { data: etapasCultivo } = useCollection<EtapaCultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'etapasCultivo') : null, [firestore]));
  const { data: insumos } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos'), orderBy('nombre')) : null, [firestore]));
  const { data: compras } = useCollection<Compra>(useMemoFirebase(() => firestore ? collection(firestore, 'compras') : null, [firestore]));

  const getInitialValues = () => {
    const base = evento 
      ? { ...evento, fecha: new Date(evento.fecha as string) } 
      : draft && Object.keys(draft).length > 0
        ? { ...draft, fecha: draft.fecha ? new Date(draft.fecha) : new Date() }
        : {
            fecha: new Date(),
            tipo: 'siembra',
            productos: [],
            descripcion: "",
          };

    // Ensure optional number fields are not undefined
    return {
      ...base,
      hectareasAplicadas: base.hectareasAplicadas ?? '',
      costoServicioPorHa: base.costoServicioPorHa ?? '',
      temperatura: base.temperatura ?? '',
      humedad: base.humedad ?? '',
      viento: base.viento ?? '',
      toneladas: base.toneladas ?? '',
      precioTonelada: base.precioTonelada ?? '',
      resultado: base.resultado ?? '',
    };
  }

  const form = useForm<EventoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues() as any,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "productos",
  });

  const watchedValues = form.watch();
  const watchedValuesRef = useRef(watchedValues);

  // Solo actualiza la ref si los valores han cambiado realmente
  if (!isEqual(watchedValuesRef.current, watchedValues)) {
    watchedValuesRef.current = watchedValues;
  }

  useEffect(() => {
    if (evento) return;

    const intervalId = setInterval(() => {
        setDraft(watchedValuesRef.current as EventoBorrador);
    }, 1000); // Save every second

    return () => clearInterval(intervalId);
  }, [evento, setDraft]);


  const tipoEvento = form.watch('tipo');
  const watchedHectareas = form.watch('hectareasAplicadas');
  const watchedProductos = form.watch('productos');
  const watchedCostoServicio = form.watch('costoServicioPorHa');
  const watchedParcelaId = form.watch('parcelaId');
  const watchedZafraId = form.watch('zafraId');
  const watchedFecha = form.watch('fecha');


  const stockCalculado = useMemo(() => {
    if (!insumos || !compras || !todosLosEventos) return {};

    const allEvents: (
      { type: 'entrada'; fecha: Date; insumoId: string; cantidad: number; costo: number; } |
      { type: 'salida'; fecha: Date; insumoId: string; cantidad: number; }
    )[] = [];

    insumos.forEach(insumo => {
        if (insumo.stockActual > 0) {
            allEvents.push({ type: 'entrada', fecha: new Date('2000-01-01'), insumoId: insumo.id, cantidad: insumo.stockActual, costo: insumo.costoUnitario });
        }
    });

    compras.forEach(compra => {
        compra.items.forEach(item => {
            allEvents.push({ type: 'entrada', fecha: new Date(compra.fecha as string), insumoId: item.insumoId, cantidad: item.cantidad, costo: item.precioUnitario });
        });
    });

    todosLosEventos.forEach(evento => {
        evento.productos?.forEach(prod => {
            allEvents.push({ type: 'salida', fecha: new Date(evento.fecha as string), insumoId: prod.insumoId, cantidad: prod.cantidad });
        });
    });
    
    allEvents.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const stockFinal: Record<string, { stock: number; unidad: string; }> = {};
    insumos.forEach(insumo => {
        let currentStock = 0;
        const insumoMovements = allEvents.filter(e => e.insumoId === insumo.id);
        
        insumoMovements.forEach(mov => {
            if (mov.type === 'entrada') {
                currentStock += mov.cantidad;
            } else if (mov.type === 'salida') {
                currentStock -= mov.cantidad;
            }
        });

        stockFinal[insumo.id] = { stock: Math.max(0, currentStock), unidad: insumo.unidad };
    });

    return stockFinal;
  }, [insumos, compras, todosLosEventos]);

  const insumosConStock = useMemo(() => {
    if (!insumos) return [];
    return insumos.filter(insumo => (stockCalculado[insumo.id]?.stock || 0) > 0);
  }, [insumos, stockCalculado]);

  // Effect for auto-calculation of `cantidad`
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        if (name && (name.startsWith('productos') || name === 'hectareasAplicadas')) {
            const hectareas = value.hectareasAplicadas || 0;
            if (hectareas > 0) {
                value.productos?.forEach((producto, index) => {
                    if (producto && producto.dosis > 0) {
                        const nuevaCantidad = producto.dosis * hectareas;
                        const campoCantidad = `productos.${index}.cantidad` as const;
                        if (form.getValues(campoCantidad) !== nuevaCantidad) {
                            form.setValue(campoCantidad, nuevaCantidad, { shouldValidate: true });
                        }
                    }
                });
            }
        }
    });
    return () => subscription.unsubscribe();
  }, [form]);

    const insumoCosts = useMemo(() => {
        const costs: Record<string, number> = {};
        if (!compras || !insumos) return costs;

        // Start with base costs from insumos
        insumos.forEach(insumo => {
            costs[insumo.id] = insumo.costoUnitario || 0;
        });

        // Sort purchases by date to get the latest price
        const sortedCompras = [...compras].sort((a, b) => new Date(b.fecha as string).getTime() - new Date(a.fecha as string).getTime());

        sortedCompras.forEach(compra => {
            compra.items.forEach(item => {
                if (!costs[item.insumoId] || costs[item.insumoId] === 0) {
                     // If we haven't found a newer price, use this one
                    if (new Date(compra.fecha as string) > (new Date('2000-01-01'))) { // A bit of a hack to prioritize purchase prices
                         costs[item.insumoId] = item.precioUnitario;
                    }
                }
            });
        });
        
         // Last pass to ensure we have the latest price for everything
        insumos.forEach(insumo => {
            const relevantPurchases = compras.flatMap(c => c.items.filter(i => i.insumoId === insumo.id).map(i => ({...i, fecha: new Date(c.fecha as string)})));
            if (relevantPurchases.length > 0) {
                const latestPurchase = relevantPurchases.sort((a,b) => b.fecha.getTime() - a.fecha.getTime())[0];
                costs[insumo.id] = latestPurchase.precioUnitario;
            }
        });


        return costs;
    }, [compras, insumos]);
  
  const totalCostoEvento = useMemo(() => {
    const costoProductos = watchedProductos?.reduce((acc, prod) => {
        if (!prod || !prod.insumoId || !prod.cantidad) {
            return acc;
        }
        const costoUnitario = insumoCosts[prod.insumoId] || 0;
        return acc + (prod.cantidad * costoUnitario);
    }, 0) || 0;

    const costoServicio = (Number(watchedHectareas) || 0) * (Number(watchedCostoServicio) || 0);
    
    return costoProductos + costoServicio;
  }, [watchedProductos, watchedHectareas, watchedCostoServicio, insumoCosts]);

  const analisisProps = useMemo(() => ({
    eventoActual: { ...form.getValues(), fecha: watchedFecha, parcelaId: watchedParcelaId, zafraId: watchedZafraId } as Evento,
    todosLosEventos: todosLosEventos || [],
    zafras: zafras || [],
    etapasCultivo: etapasCultivo || [],
  }), [watchedParcelaId, watchedZafraId, watchedFecha, form, todosLosEventos, zafras, etapasCultivo]);


  const handleSubmit = (data: EventoFormValues) => {
    const dataConCostoTotal = {
      ...data,
      costoTotal: totalCostoEvento
    };
    onSave(dataConCostoTotal);
    clearDraft();
  };

  const handleDiscard = () => {
    clearDraft();
    form.reset({
        fecha: new Date(),
        tipo: 'siembra',
        productos: [],
        descripcion: "",
    });
    toast({
        title: 'Borrador descartado',
        description: 'El formulario se ha limpiado.',
    })
  }

  if (!parcelas || !cultivos || !zafras || !etapasCultivo || !insumos) {
    return <p>Cargando datos maestros...</p>;
  }

  return (
    <>
      <EventoAnalisisPanel {...analisisProps} />
      <Card>
        <CardContent className="p-6 mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField name="parcelaId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Parcela</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una parcela" /></SelectTrigger></FormControl><SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="cultivoId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cultivo / Variedad</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cultivo" /></SelectTrigger></FormControl><SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="zafraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Zafra</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl><SelectContent>{zafras.filter(z => z.estado === 'en curso' || z.estado === 'planificada').map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField name="tipo" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Tipo de Evento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="siembra">Siembra</SelectItem><SelectItem value="aplicacion">Aplicación</SelectItem><SelectItem value="fertilización">Fertilización</SelectItem><SelectItem value="riego">Riego</SelectItem><SelectItem value="cosecha">Cosecha</SelectItem><SelectItem value="rendimiento">Rendimiento</SelectItem><SelectItem value="mantenimiento">Mantenimiento</SelectItem><SelectItem value="plagas">Control de Plagas</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha del Evento</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              </div>
              <FormField name="descripcion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Describa el evento..." {...field} /></FormControl><FormMessage /></FormItem> )} />

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
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ insumoId: '', dosis: 0, cantidad: 0 })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto
                    </Button>
                  </CardHeader>
                  <CardContent className="p-2 space-y-4">
                     {fields.map((field, index) => {
                       const selectedInsumoId = form.watch(`productos.${index}.insumoId`);
                       const stockInfo = selectedInsumoId ? stockCalculado[selectedInsumoId] : null;

                       return (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] items-end gap-4 p-4 border rounded-md bg-background">
                            <FormField name={`productos.${index}.insumoId`} control={form.control} render={({ field }) => ( 
                                <FormItem>
                                    <FormLabel>Insumo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {insumosConStock.map(i => {
                                                const stockInfo = stockCalculado[i.id];
                                                return (
                                                    <SelectItem key={i.id} value={i.id}>
                                                        {i.nombre} ({stockInfo.stock.toFixed(2)} {stockInfo.unidad})
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                     </Select>
                                     {stockInfo && <FormDescription className="text-xs pt-1">Stock Disponible: {stockInfo.stock.toFixed(2)} {stockInfo.unidad}</FormDescription>}
                                    <FormMessage />
                                </FormItem> 
                            )}/>
                            <FormField name={`productos.${index}.dosis`} control={form.control} render={({ field }) => ( <FormItem><FormLabel>Dosis/ha</FormLabel><FormControl><Input className="w-28" type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField name={`productos.${index}.cantidad`} control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cant. Total</FormLabel><FormControl><Input className="w-28 bg-muted/70" type="number" placeholder="0" {...field} readOnly /></FormControl><FormMessage /></FormItem> )}/>
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                       )
                     })}
                     {fields.length === 0 && ( <p className="text-sm text-muted-foreground text-center py-4">No se han agregado productos.</p> )}
                     <div className="flex justify-end pt-4">
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-background border border-primary/20">
                            <DollarSign className="h-6 w-6 text-primary" />
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Costo Total del Evento</p>
                                <p className="text-xl font-bold text-primary">${totalCostoEvento.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                     </div>
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

              <div className="flex justify-between items-center pt-4">
                <Button type="button" variant="ghost" onClick={handleDiscard} className="text-destructive hover:text-destructive">
                    <Eraser className="mr-2"/>
                    Descartar Borrador
                </Button>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button type="submit">{evento ? "Guardar Cambios" : "Registrar Evento"}</Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}


"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Evento, Parcela, Cultivo, Zafra, Insumo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon, Cloud, Thermometer, Wind, Upload, File, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { mockInsumos } from "@/lib/mock-data";

const formSchema = z.object({
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  tipo: z.enum(['siembra', 'fertilización', 'riego', 'cosecha', 'mantenimiento', 'plagas', 'aplicacion']),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  descripcion: z.string().min(5, "La descripción es muy corta."),
  
  // Campos de aplicación
  insumoId: z.string().optional(),
  dosis: z.coerce.number().optional(),
  
  // Campos climáticos
  temperatura: z.coerce.number().optional(),
  humedad: z.coerce.number().optional(),
  viento: z.coerce.number().optional(),

  // Campos de evento genéricos (mantener por compatibilidad)
  insumos: z.string().optional(),
  cantidad: z.coerce.number().optional(),
  unidad: z.string().optional(),
  resultado: z.string().optional(),
});

type EventoFormValues = z.infer<typeof formSchema>;

interface EventoFormProps {
  evento?: Evento;
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
}

export function EventoForm({ evento, parcelas, cultivos, zafras }: EventoFormProps) {
  const router = useRouter();
  const form = useForm<EventoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: evento ? {
      ...evento,
      fecha: new Date(evento.fecha),
      tipo: evento.tipo as any // Fix para enum
    } : {
      fecha: new Date(),
      tipo: 'siembra',
    },
  });

  const tipoEvento = form.watch('tipo');

  const handleSubmit = (data: EventoFormValues) => {
    console.log("Evento guardado:", data);
    // Lógica para descontar stock y crear costo si es aplicación
    if (data.tipo === 'aplicacion' && data.insumoId && data.dosis) {
      const insumo = mockInsumos.find(i => i.id === data.insumoId);
      if (insumo) {
        console.log(`Descontando ${data.dosis} de ${insumo.nombre}`);
        // Aquí iría la lógica de API
        const costo = data.dosis * (insumo.costoUnitario || 0);
        console.log(`Registrando costo de $${costo}`);
      }
    }
    // Lógica para cambiar estado de parcela a 'en barbecho' si es cosecha
    if (data.tipo === 'cosecha') {
        console.log(`Cambiando estado de parcela ${data.parcelaId} a 'en barbecho'`);
    }
    router.push("/eventos");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                name="parcelaId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcela</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una parcela" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="cultivoId"
                control={form.control}
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
                        {cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="zafraId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zafra</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una zafra" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {zafras.filter(z => z.estado === 'en curso').map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                name="tipo"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Evento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="siembra">Siembra</SelectItem>
                        <SelectItem value="aplicacion">Aplicación</SelectItem>
                        <SelectItem value="fertilización">Fertilización</SelectItem>
                        <SelectItem value="riego">Riego</SelectItem>
                        <SelectItem value="cosecha">Cosecha</SelectItem>
                        <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                        <SelectItem value="plagas">Control de Plagas</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="fecha"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2">
                    <FormLabel>Fecha del Evento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              name="descripcion"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describa el evento..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoEvento === 'aplicacion' && (
              <Card className="bg-muted/30 p-4">
                <CardHeader className="p-2"><CardTitle className="text-lg">Detalles de Aplicación</CardTitle></CardHeader>
                <CardContent className="p-2 space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        name="insumoId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Producto/Insumo</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione un insumo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mockInsumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="dosis"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dosis/Cantidad Total</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Ej: 200" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                   </div>
                   <div>
                     <FormLabel>Condiciones Climáticas</FormLabel>
                     <div className="grid grid-cols-3 gap-4 mt-2">
                        <FormField
                          name="temperatura"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Temp (°C)</FormLabel>
                              <div className="relative">
                                <Thermometer className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                  <Input type="number" className="pl-8" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="humedad"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Humedad (%)</FormLabel>
                              <div className="relative">
                                <Cloud className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                  <Input type="number" className="pl-8" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="viento"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Viento (km/h)</FormLabel>
                              <div className="relative">
                                <Wind className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                  <Input type="number" className="pl-8" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                     </div>
                   </div>
                </CardContent>
              </Card>
            )}

            {tipoEvento !== 'aplicacion' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="insumos" render={({ field }) => (<FormItem><FormLabel>Insumos</FormLabel><FormControl><Input placeholder="Ej: Semillas, Fertilizante" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="cantidad" render={({ field }) => (<FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" placeholder="Ej: 100" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="unidad" render={({ field }) => (<FormItem><FormLabel>Unidad</FormLabel><FormControl><Input placeholder="Ej: kg, l, ton" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            )}
            
            <FormField control={form.control} name="resultado" render={({ field }) => (<FormItem><FormLabel>Resultado/Observaciones</FormLabel><FormControl><Textarea placeholder="Observaciones sobre el resultado..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
             <div>
              <FormLabel>Adjuntos</FormLabel>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-input px-6 py-10">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                  <div className="mt-4 flex text-sm leading-6 text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md bg-white font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary/80"
                    >
                      <span>Subir un archivo</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple />
                    </label>
                    <p className="pl-1">o arrastrar y soltar</p>
                  </div>
                  <p className="text-xs leading-5 text-gray-600">Imágenes o PDF de hasta 10MB.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
              <Button type="submit">{evento ? "Guardar Cambios" : "Registrar Evento"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    
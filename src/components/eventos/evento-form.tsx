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
import { Card, CardContent } from "@/components/ui/card";
import type { Evento, Parcela, Cultivo, Zafra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  tipo: z.enum(['siembra', 'fertilización', 'riego', 'cosecha', 'mantenimiento', 'plagas']),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  descripcion: z.string().min(5, "La descripción es muy corta."),
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
    defaultValues: evento || {
      fecha: new Date(),
    },
  });

  const handleSubmit = (data: EventoFormValues) => {
    console.log("Evento guardado:", data);
    // Here you would typically call an API to save the data
    router.push("/eventos");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="parcelaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcela</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una parcela" /></SelectTrigger></FormControl>
                      <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cultivoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cultivo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cultivo" /></SelectTrigger></FormControl>
                      <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl>
                      <SelectContent>{zafras.filter(z => z.estado === 'en curso').map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Evento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="siembra">Siembra</SelectItem>
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
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2">
                    <FormLabel>Fecha del Evento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea placeholder="Describa el evento..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="insumos" render={({ field }) => (<FormItem><FormLabel>Insumos</FormLabel><FormControl><Input placeholder="Ej: Semillas, Fertilizante" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="cantidad" render={({ field }) => (<FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" placeholder="Ej: 100" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="unidad" render={({ field }) => (<FormItem><FormLabel>Unidad</FormLabel><FormControl><Input placeholder="Ej: kg, l, ton" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <FormField control={form.control} name="resultado" render={({ field }) => (<FormItem><FormLabel>Resultado/Observaciones</FormLabel><FormControl><Textarea placeholder="Observaciones sobre el resultado..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
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

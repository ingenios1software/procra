"use client";

import { useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import type { Venta, Cliente, Insumo, MovimientoStock, Deposito } from "@/lib/types";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';

const itemSchema = z.object({
  productoId: z.string().nonempty("Debe seleccionar un producto."),
  descripcion: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio debe ser mayor a 0."),
  descuentoPorc: z.coerce.number().min(0, "El descuento no puede ser negativo.").optional().default(0),
});

const formSchema = z.object({
  numeroDocumento: z.string().nonempty("El número de documento es obligatorio."),
  clienteId: z.string().nonempty("Debe seleccionar un cliente."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  moneda: z.enum(['USD', 'PYG']),
  formaPago: z.string().optional(),
  vendedorId: z.string().optional(),
  depositoOrigenId: z.string().nonempty("Debe seleccionar un depósito de origen."),
  observacion: z.string().optional(),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un producto."),
});

type VentaFormValues = z.infer<typeof formSchema>;

interface VentaFormProps {
    venta?: Venta | null;
    onCancel: () => void;
}

export function VentaForm({ venta, onCancel }: VentaFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const { data: clientes } = useCollection<Cliente>(useMemoFirebase(() => firestore ? collection(firestore, 'clientes') : null, [firestore]));
  const { data: depositos } = useCollection<Deposito>(useMemoFirebase(() => firestore ? collection(firestore, 'depositos') : null, [firestore]));
  
  const form = useForm<VentaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: venta ? {
      ...venta,
      fecha: new Date(venta.fecha as string),
    } : {
      fecha: new Date(),
      moneda: 'USD',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });

  const totalVenta = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        const descuento = Number(item.descuentoPorc) || 0;
        const subtotal = cantidad * precio * (1 - descuento / 100);
        return acc + subtotal;
    }, 0);
  }, [watchedItems]);

  const handleSubmit = async (data: VentaFormValues) => {
    if (!firestore || !user) {
        toast({ variant: "destructive", title: "Error de autenticación." });
        return;
    }

    const batch = writeBatch(firestore);
    const ventaRef = venta ? doc(firestore, "ventas", venta.id) : doc(collection(firestore, "ventas"));

    const itemsFinal = data.items.map(item => ({
        ...item,
        subtotal: (item.cantidad * item.precioUnitario) * (1 - (item.descuentoPorc || 0) / 100)
    }));
    
    const ventaData: Omit<Venta, 'id'> = {
        ...data,
        fecha: (data.fecha as Date).toISOString(),
        items: itemsFinal,
        total: totalVenta,
    };
    
    if (venta) {
        batch.update(ventaRef, ventaData as any);
    } else {
        batch.set(ventaRef, ventaData);
    }

    // Lógica de Movimientos de Stock y actualización de Insumos
    for (const item of data.items) {
        const insumoRef = doc(firestore, "insumos", item.productoId);
        const insumoDoc = await getDoc(insumoRef);

        if (insumoDoc.exists()) {
            const insumoActual = insumoDoc.data() as Insumo;
            const stockAnterior = insumoActual.stockActual || 0;
            const stockDespues = stockAnterior - item.cantidad;

            // 1. Actualizar el stock del insumo
            batch.update(insumoRef, { stockActual: stockDespues });

            // 2. Crear movimiento de stock
            const movimientoRef = doc(collection(firestore, "movimientosStock"));
            const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
                fecha: data.fecha,
                tipo: "salida",
                origen: "venta",
                documentoOrigen: data.numeroDocumento,
                ventaId: ventaRef.id,
                depositoId: data.depositoOrigenId,
                insumoId: item.productoId,
                insumoNombre: insumoActual.nombre,
                unidad: insumoActual.unidad,
                categoria: insumoActual.categoria,
                cantidad: item.cantidad,
                stockAntes: stockAnterior,
                stockDespues: stockDespues,
                precioUnitario: item.precioUnitario,
                costoTotal: item.cantidad * item.precioUnitario,
                creadoPor: user.uid,
                creadoEn: new Date(),
            };
            batch.set(movimientoRef, nuevoMovimiento);
        }
    }

    try {
        await batch.commit();
        toast({ title: venta ? "Venta actualizada con éxito" : "Venta registrada con éxito" });
        onCancel();
    } catch (e: any) {
        console.error("Error al guardar la venta:", e);
        toast({ variant: "destructive", title: "Error al guardar", description: e.message });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField name="numeroDocumento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>N° Documento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="clienteId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cliente</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger></FormControl><SelectContent>{(clientes || []).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField name="moneda" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PYG">PYG</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="formaPago" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Forma de Pago</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="depositoOrigenId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Depósito de Origen</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un depósito" /></SelectTrigger></FormControl><SelectContent>{(depositos || []).map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
          </div>
          <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />

          <Table>
              <TableHeader><TableRow><TableHead className="w-[350px]">Producto</TableHead><TableHead>Cantidad</TableHead><TableHead>Precio Unit.</TableHead><TableHead>Desc. (%)</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                  {fields.map((field, index) => {
                      const item = watchedItems?.[index];
                      const cantidad = Number(item?.cantidad) || 0;
                      const precio = Number(item?.precioUnitario) || 0;
                      const descuento = Number(item?.descuentoPorc) || 0;
                      const subtotal = cantidad * precio * (1 - descuento / 100);

                      return (
                          <TableRow key={field.id} className="align-top">
                              <TableCell className="p-1">
                                <FormField control={form.control} name={`items.${index}.productoId`} render={({ field: formField }) => (
                                    <SelectorUniversal<Insumo> label="Producto" collectionName="insumos" displayField="nombre" codeField="numeroItem" value={form.getValues(`items.${index}.productoId`)} onSelect={(insumo) => form.setValue(`items.${index}.productoId`, insumo?.id || '')} searchFields={['nombre', 'numeroItem']} />
                                )}/>
                              </TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.cantidad`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.precioUnitario`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.descuentoPorc`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="text-right font-mono p-1 align-middle">${formatCurrency(subtotal)}</TableCell>
                              <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                      );
                  })}
              </TableBody>
              <TableFooter>
                  <TableRow className="text-lg"><TableCell colSpan={4} className="text-right font-bold">TOTAL VENTA</TableCell><TableCell className="text-right font-bold font-mono">${formatCurrency(totalVenta)}</TableCell><TableCell></TableCell></TableRow>
              </TableFooter>
          </Table>
          <Button type="button" variant="outline" size="sm" onClick={() => append({} as any)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto</Button>
          
          <div className="flex justify-between items-center pt-6 border-t">
              <div className="text-xl font-bold">Total Factura: <span className="font-mono">${formatCurrency(totalVenta)}</span></div>
              <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                  <Button type="submit">{venta ? "Guardar Cambios" : "Guardar Venta"}</Button>
              </div>
          </div>
      </form>
    </Form>
  );
}

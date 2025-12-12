"use client";

import { useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Compra, Proveedor, Zafra, Insumo, MovimientoStock } from "@/lib/types";
import { useCollection, useFirestore, useUser, addDocumentNonBlocking, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';

const itemSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo válido." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio debe ser mayor a 0."),
  porcentajeIva: z.enum(['0', '5', '10']).default('10'),
});

const formSchema = z.object({
  proveedorId: z.string().nonempty("Debe seleccionar un proveedor."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  numeroDocumento: z.string().min(3, "El número de documento es muy corto."),
  tipoDocumento: z.enum(['Factura', 'Nota de Crédito', 'Remisión']),
  condicion: z.enum(['Contado', 'Crédito']),
  tipoCompra: z.enum(['Externa', 'Interna']),
  observacion: z.string().optional(),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un ítem a la compra."),
});

type CompraFormValues = z.infer<typeof formSchema>;

export function CompraForm() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => firestore ? collection(firestore, 'proveedores') : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));

  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha: new Date(),
      tipoDocumento: 'Factura',
      condicion: 'Contado',
      tipoCompra: 'Externa',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch('items');

  const { subtotal, iva5, iva10, totalIva, totalGeneral } = useMemo(() => {
    let subtotal = 0;
    let baseIva5 = 0;
    let baseIva10 = 0;

    for (const item of watchedItems) {
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precioUnitario) || 0;
      const base = cantidad * precio;

      subtotal += base;

      if (item.porcentajeIva === '5') {
        baseIva5 += base;
      } else if (item.porcentajeIva === '10') {
        baseIva10 += base;
      }
    }
    
    const iva5 = baseIva5 * 0.05;
    const iva10 = baseIva10 * 0.1;
    const totalIva = iva5 + iva10;
    const totalGeneral = subtotal + totalIva;
    
    return { subtotal, iva5, iva10, totalIva, totalGeneral };
  }, [watchedItems]);


  const handleSubmit = async (data: CompraFormValues) => {
    if (!firestore || !user) return;
    
    const batch = writeBatch(firestore);

    // 1. Crear el documento de Compra
    const compraRef = doc(collection(firestore, "compras"));
    
    const compraData = {
        proveedorId: data.proveedorId,
        zafraId: data.zafraId,
        fecha: (data.fecha as Date).toISOString(),
        numeroDocumento: data.numeroDocumento,
        tipoDocumento: data.tipoDocumento,
        condicion: data.condicion,
        tipoCompra: data.tipoCompra,
        observacion: data.observacion || null,
        total: totalGeneral,
        estado: 'Registrado',
        creadoPor: user.uid,
        creadoEn: new Date(),
        items: data.items.map(item => ({
            insumoId: item.insumo.id,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            porcentajeIva: item.porcentajeIva,
        })),
    };
    batch.set(compraRef, compraData);

    // 2. Crear movimientos de stock y actualizar stock de insumos
    for (const item of data.items) {
        const insumo = item.insumo as Insumo;
        
        // Crear movimiento
        const movimientoRef = doc(collection(firestore, "MovimientosStock"));
        const stockAntes = insumo.stockActual || 0;
        const nuevoStock = stockAntes + item.cantidad;
        const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
            fecha: data.fecha,
            tipo: "entrada",
            origen: "compra",
            compraId: compraRef.id,
            insumoId: insumo.id,
            insumoNombre: insumo.nombre,
            unidad: insumo.unidad,
            categoria: insumo.categoria,
            cantidad: item.cantidad,
            stockAntes,
            stockDespues: nuevoStock,
            precioUnitario: item.precioUnitario,
            costoTotal: item.cantidad * item.precioUnitario,
            creadoPor: user.uid,
            creadoEn: new Date(),
        };
        batch.set(movimientoRef, nuevoMovimiento);

        // Actualizar stock del insumo
        const insumoRef = doc(firestore, "insumos", insumo.id);
        batch.update(insumoRef, { stockActual: nuevoStock });
    }
    
    try {
        await batch.commit();
        toast({
            title: `Compra registrada`,
            description: `La compra con N° ${data.numeroDocumento} ha sido guardada.`,
        });
        router.push("/comercial/compras");
    } catch (error) {
        console.error("Error al guardar la compra: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Ocurrió un error al intentar guardar la compra."
        });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField name="proveedorId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Proveedor</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="zafraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Zafra</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl><SelectContent>{zafras?.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField name="tipoDocumento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Tipo de Documento</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Factura">Factura</SelectItem><SelectItem value="Nota de Crédito">Nota de Crédito</SelectItem><SelectItem value="Remisión">Remisión</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="numeroDocumento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>N° de Documento</FormLabel><FormControl><Input placeholder="001-001-123456" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="condicion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Condición de Pago</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
            </div>
             <FormField name="tipoCompra" control={form.control} render={({ field }) => ( <FormItem className="w-full md:w-1/3"><FormLabel>Tipo de Compra</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Externa">Externa</SelectItem><SelectItem value="Interna">Interna</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
            <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Notas adicionales sobre la compra..." {...field} /></FormControl><FormMessage /></FormItem> )} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Detalles de la Compra</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[350px]">Insumo</TableHead><TableHead>Cantidad</TableHead><TableHead>Precio Unitario</TableHead><TableHead>IVA (%)</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id} className="align-top">
                                <TableCell className="font-medium">
                                    <FormField control={form.control} name={`items.${index}.insumo`} render={({ field, fieldState }) => (
                                        <FormItem>
                                            <SelectorUniversal<Insumo> label="Insumo" collectionName="insumos" displayField="nombre" codeField="numeroItem" value={field.value} onSelect={field.onChange} searchFields={['nombre', 'numeroItem']} />
                                            {fieldState.error && <FormMessage />}
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell>
                                    <FormField control={form.control} name={`items.${index}.cantidad`} render={({ field }) => ( <FormItem><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </TableCell>
                                <TableCell>
                                     <FormField control={form.control} name={`items.${index}.precioUnitario`} render={({ field }) => ( <FormItem><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </TableCell>
                                <TableCell>
                                     <FormField control={form.control} name={`items.${index}.porcentajeIva`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="0">0%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="10">10%</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    ${((form.watch(`items.${index}.cantidad`) || 0) * (form.watch(`items.${index}.precioUnitario`) || 0)).toLocaleString('en-US')}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow><TableCell colSpan={4} className="text-right font-bold">Subtotal</TableCell><TableCell className="text-right font-mono">${subtotal.toLocaleString('en-US')}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow><TableCell colSpan={4} className="text-right">IVA (5%)</TableCell><TableCell className="text-right font-mono">${iva5.toLocaleString('en-US')}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow><TableCell colSpan={4} className="text-right">IVA (10%)</TableCell><TableCell className="text-right font-mono">${iva10.toLocaleString('en-US')}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow className="text-lg bg-muted/50"><TableCell colSpan={4} className="text-right font-bold">Total</TableCell><TableCell className="text-right font-bold font-mono">${totalGeneral.toLocaleString('en-US')}</TableCell><TableCell></TableCell></TableRow>
                    </TableFooter>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ insumo: undefined, cantidad: 0, precioUnitario: 0, porcentajeIva: '10' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem
                </Button>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit">Guardar Compra</Button>
        </div>
      </form>
    </Form>
  );
}
 
    
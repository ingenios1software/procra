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
import { cn, formatCurrency } from "@/lib/utils";
import type { Compra, Proveedor, Zafra, Insumo, MovimientoStock } from "@/lib/types";
import { useCollection, useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useMemoFirebase } from "@/firebase";
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

interface CompraFormProps {
    compra?: Compra | null;
    onCancel: () => void;
}

export function CompraForm({ compra, onCancel }: CompraFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => firestore ? collection(firestore, 'proveedores') : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));

  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
        ...compra,
        fecha: new Date(compra.fecha as string),
    } : {
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

  const { baseIva10, baseIva5, exento, iva10, iva5, totalGeneral } = useMemo(() => {
    let base10 = 0;
    let base5 = 0;
    let base0 = 0;

    watchedItems.forEach((item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        const totalItem = cantidad * precio;
        
        if (item.porcentajeIva === '10') {
            base10 += totalItem;
        } else if (item.porcentajeIva === '5') {
            base5 += totalItem;
        } else {
            base0 += totalItem;
        }
    });

    const iva10Calculado = base10 / 11;
    const iva5Calculado = base5 / 21;
    const total = base10 + base5 + base0;

    return {
        baseIva10: base10,
        baseIva5: base5,
        exento: base0,
        iva10: iva10Calculado,
        iva5: iva5Calculado,
        totalGeneral: total,
    };
}, [watchedItems]);


  const handleSubmit = async (data: CompraFormValues) => {
    if (!firestore || !user) return;
    
    const batch = writeBatch(firestore);
    
    const itemsSanitized = data.items.map(item => ({
        insumoId: item.insumo.id,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        porcentajeIva: item.porcentajeIva,
    }));

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
        items: itemsSanitized,
    };
    
    // Si estamos editando
    if (compra) {
        const compraRef = doc(firestore, "compras", compra.id);
        // Aquí faltaría la lógica para revertir movimientos de stock anteriores
        // y aplicar los nuevos. Por ahora solo actualizamos el documento.
        updateDocumentNonBlocking(compraRef, compraData);

    } else { // Si estamos creando
        const compraRef = doc(collection(firestore, "compras"));
        batch.set(compraRef, compraData);

        for (const item of data.items) {
            const insumo = item.insumo as Insumo;
            
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

            const insumoRef = doc(firestore, "insumos", insumo.id);
            batch.update(insumoRef, { stockActual: nuevoStock });
        }
    }
    
    try {
        if (!compra) {
            await batch.commit();
        }
        toast({
            title: compra ? "Compra actualizada" : "Compra registrada",
            description: `La compra con N° ${data.numeroDocumento} ha sido guardada.`,
        });
        onCancel();
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8 p-1">
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
                    <TableHeader><TableRow><TableHead className="w-[300px]">Insumo</TableHead><TableHead>Cantidad</TableHead><TableHead>Precio Unit.</TableHead><TableHead>IVA (%)</TableHead><TableHead className="text-right">Valor 10%</TableHead><TableHead className="text-right">Valor 5%</TableHead><TableHead className="text-right">Exento</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {fields.map((field, index) => {
                            const item = watchedItems[index];
                            const totalItem = (item.cantidad || 0) * (item.precioUnitario || 0);
                            return (
                                <TableRow key={field.id} className="align-top">
                                    <TableCell className="font-medium p-1"><FormField control={form.control} name={`items.${index}.insumo`} render={({ field: formField, fieldState }) => (<FormItem><SelectorUniversal<Insumo> label="Insumo" collectionName="insumos" displayField="nombre" codeField="numeroItem" value={formField.value} onSelect={formField.onChange} searchFields={['nombre', 'numeroItem']} /><FormMessage /></FormItem> )} /></TableCell>
                                    <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.cantidad`} render={({ field: formField }) => <Input type="number" placeholder="0" {...formField} />} /></TableCell>
                                    <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.precioUnitario`} render={({ field: formField }) => <Input type="number" placeholder="0" {...formField} />} /></TableCell>
                                    <TableCell className="p-1"><FormField control={form.control} name={`items.${index}.porcentajeIva`} render={({ field: formField }) => (<Select onValueChange={formField.onChange} defaultValue={formField.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="0">0%</SelectItem></SelectContent></Select>)}/></TableCell>
                                    <TableCell className="text-right font-mono p-1 align-middle">${item.porcentajeIva === '10' ? formatCurrency(totalItem) : '0,00'}</TableCell>
                                    <TableCell className="text-right font-mono p-1 align-middle">${item.porcentajeIva === '5' ? formatCurrency(totalItem) : '0,00'}</TableCell>
                                    <TableCell className="text-right font-mono p-1 align-middle">${item.porcentajeIva === '0' ? formatCurrency(totalItem) : '0,00'}</TableCell>
                                    <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow><TableCell colSpan={4} className="text-right font-bold">Subtotal</TableCell><TableCell className="text-right font-mono">${formatCurrency(baseIva10)}</TableCell><TableCell className="text-right font-mono">${formatCurrency(baseIva5)}</TableCell><TableCell className="text-right font-mono">${formatCurrency(exento)}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow><TableCell colSpan={4} className="text-right">IVA (10%)</TableCell><TableCell className="text-right font-mono" colSpan={3}>${formatCurrency(iva10)}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow><TableCell colSpan={4} className="text-right">IVA (5%)</TableCell><TableCell className="text-right font-mono" colSpan={3}>${formatCurrency(iva5)}</TableCell><TableCell></TableCell></TableRow>
                        <TableRow className="text-lg bg-muted/50"><TableCell colSpan={4} className="text-right font-bold">Total</TableCell><TableCell className="text-right font-bold font-mono" colSpan={3}>${formatCurrency(totalGeneral)}</TableCell><TableCell></TableCell></TableRow>
                    </TableFooter>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ insumo: undefined, cantidad: 0, precioUnitario: 0, porcentajeIva: '10' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem
                </Button>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{compra ? "Guardar Cambios" : "Guardar Compra"}</Button>
        </div>
      </form>
    </Form>
  );
}

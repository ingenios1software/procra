"use client";

import { useMemo, useState, useEffect } from 'react';
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
import type { Venta, Cliente, Insumo, MovimientoStock, Deposito, AsientoDiario } from "@/lib/types";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const itemSchema = z.object({
  producto: z.any().refine(val => val && val.id, { message: "Debe seleccionar un producto." }),
  descripcion: z.string().optional(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo."),
  descuentoPorc: z.coerce.number().min(0).optional().default(0),
});

const formSchema = z.object({
  numeroDocumento: z.string().nonempty("El número de documento es obligatorio."),
  clienteId: z.string().nonempty("Debe seleccionar un cliente."),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  moneda: z.enum(['USD', 'PYG']),
  formaPago: z.enum(['Contado', 'Transferencia', 'Crédito']),
  vencimiento: z.date().optional(),
  vendedorId: z.string().optional(),
  depositoOrigenId: z.string().nonempty("Debe seleccionar un depósito de origen."),
  observacion: z.string().optional(),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un producto."),
}).refine(data => {
    if (data.formaPago === 'Crédito' && !data.vencimiento) {
        return false;
    }
    return true;
}, {
    message: "El vencimiento es obligatorio para ventas a crédito.",
    path: ["vencimiento"],
});

type VentaFormValues = z.infer<typeof formSchema>;

interface VentaFormProps {
    venta?: Venta | null;
    onCancel: () => void;
    clientes: Cliente[];
    depositos: Deposito[];
}

// IDs de Cuentas Contables (Hardcodeado por ahora)
const CUENTAS = {
    CAJA: 'IdCajaGeneral', // Reemplazar con ID real de Firestore
    BANCO: 'IdBancoFamiliar', // Reemplazar con ID real de Firestore
    CLIENTES: 'IdCuentasPorCobrarClientes', // Reemplazar con ID real de Firestore
    VENTAS: 'IdVentasMercaderias', // Reemplazar con ID real de Firestore
    IVA_DEBITO: 'IdIVADebitoFiscal', // Reemplazar con ID real de Firestore
    CMV: 'IdCostoMercaderiaVendida', // Reemplazar con ID real de Firestore
    INVENTARIO: 'IdInventario', // Reemplazar con ID real de Firestore
};

export function VentaForm({ venta, onCancel, clientes, depositos }: VentaFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const form = useForm<VentaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: venta ? {
      ...venta,
      fecha: new Date(venta.fecha as string),
    } : {
      fecha: new Date(),
      moneda: 'PYG',
      formaPago: 'Contado',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: 'items' });

  const handleSelectProducto = (index: number, producto: Insumo) => {
    form.setValue(`items.${index}.producto`, producto);
    form.setValue(`items.${index}.descripcion`, producto.descripcion);
    form.setValue(`items.${index}.precioUnitario`, producto.precioVenta || 0);
    form.trigger(`items.${index}`);
  }

  const { totalGeneral, subtotalIva10, subtotalIva5, exenta, iva10, iva5 } = useMemo(() => {
    let subtotal10 = 0;
    let subtotal5 = 0;
    let subtotalExenta = 0;
  
    (watchedItems || []).forEach(item => {
      const producto = item.producto as Insumo | undefined;
      if (!producto) return;
  
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precioUnitario) || 0;
      const descuento = Number(item.descuentoPorc) || 0;
      const subtotal = cantidad * precio * (1 - descuento / 100);
      
      switch (producto.iva) {
        case '10':
          subtotal10 += subtotal;
          break;
        case '5':
          subtotal5 += subtotal;
          break;
        case '0':
          subtotalExenta += subtotal;
          break;
      }
    });
  
    const ivaCalculado10 = subtotal10 / 11;
    const ivaCalculado5 = subtotal5 / 21;
    const total = subtotal10 + subtotal5 + subtotalExenta;
  
    return {
      totalGeneral: total,
      subtotalIva10: subtotal10,
      subtotalIva5: subtotal5,
      exenta: subtotalExenta,
      iva10: ivaCalculado10,
      iva5: ivaCalculado5,
    };
  }, [watchedItems]);
  

  const handleSubmit = async (data: VentaFormValues) => {
    if (!firestore || !user) {
        toast({ variant: "destructive", title: "Error de autenticación." });
        return;
    }

    const batch = writeBatch(firestore);
    const ventaRef = venta ? doc(firestore, "ventas", venta.id) : doc(collection(firestore, "ventas"));

    // --- 1. Preparar y guardar documento de Venta ---
    const itemsFinal = data.items.map(item => {
        const subtotal = (item.cantidad * item.precioUnitario) * (1 - (item.descuentoPorc || 0) / 100);
        return {
            productoId: item.producto.id,
            descripcion: item.producto.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuentoPorc: item.descuentoPorc || 0,
            subtotal: subtotal,
        };
    });
    
    const ventaData: Omit<Venta, 'id'> = {
        ...data,
        fecha: (data.fecha as Date).toISOString(),
        items: itemsFinal,
        total: totalGeneral,
    };
    
    if (venta) {
        batch.update(ventaRef, ventaData as any);
    } else {
        batch.set(ventaRef, ventaData);
    }
    
    let costoTotalCMV = 0;

    // --- 2. Actualizar Stock y Crear Movimientos ---
    for (const item of data.items) {
        const producto = item.producto as Insumo;
        const insumoRef = doc(firestore, "insumos", producto.id);
        const stockActual = producto.stockActual || 0;
        const stockDespues = stockActual - item.cantidad;

        batch.update(insumoRef, { stockActual: stockDespues });

        const movimientoRef = doc(collection(firestore, "movimientosStock"));
        const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
            fecha: data.fecha,
            tipo: "salida",
            origen: "venta",
            documentoOrigen: data.numeroDocumento,
            ventaId: ventaRef.id,
            depositoId: data.depositoOrigenId,
            insumoId: producto.id,
            insumoNombre: producto.descripcion,
            unidad: producto.unidad,
            categoria: producto.categoria,
            cantidad: item.cantidad,
            stockAntes: stockActual,
            stockDespues: stockDespues,
            precioUnitario: item.precioUnitario,
            costoTotal: item.cantidad * item.precioUnitario,
            creadoPor: user.uid,
            creadoEn: new Date(),
        };
        batch.set(movimientoRef, nuevoMovimiento);
        
        // Calcular CMV
        const costoUnitario = producto.precioPromedioCalculado || 0;
        costoTotalCMV += item.cantidad * costoUnitario;
    }

    // --- 3. Generar Asientos Contables ---
    const baseImponible = (subtotalIva10 - iva10) + (subtotalIva5 - iva5) + exenta;
    const totalIva = iva10 + iva5;

    let cuentaDebeVenta;
    if (data.formaPago === 'Contado') cuentaDebeVenta = CUENTAS.CAJA;
    else if (data.formaPago === 'Transferencia') cuentaDebeVenta = CUENTAS.BANCO;
    else cuentaDebeVenta = CUENTAS.CLIENTES;

    const asientoVentaRef = doc(collection(firestore, "asientosDiario"));
    const asientoVenta: Omit<AsientoDiario, 'id'> = {
        fecha: data.fecha,
        descripcion: `Venta s/ doc ${data.numeroDocumento}`,
        movimientos: [
            { cuentaId: cuentaDebeVenta, tipo: 'debe', monto: totalGeneral },
            { cuentaId: CUENTAS.VENTAS, tipo: 'haber', monto: baseImponible },
            { cuentaId: CUENTAS.IVA_DEBITO, tipo: 'haber', monto: totalIva },
        ]
    };
    batch.set(asientoVentaRef, asientoVenta);
    
    if (costoTotalCMV > 0) {
        const asientoCMVRef = doc(collection(firestore, "asientosDiario"));
        const asientoCMV: Omit<AsientoDiario, 'id'> = {
            fecha: data.fecha,
            descripcion: `CMV por venta ${data.numeroDocumento}`,
            movimientos: [
                { cuentaId: CUENTAS.CMV, tipo: 'debe', monto: costoTotalCMV },
                { cuentaId: CUENTAS.INVENTARIO, tipo: 'haber', monto: costoTotalCMV },
            ]
        };
        batch.set(asientoCMVRef, asientoCMV);
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
        <Tabs defaultValue="detalle" className="w-full">
            <TabsList>
                <TabsTrigger value="detalle">Detalle</TabsTrigger>
                <TabsTrigger value="financiero">Financiero</TabsTrigger>
                <TabsTrigger value="observaciones">Observaciones</TabsTrigger>
            </TabsList>
            <TabsContent value="detalle" className="space-y-4 pt-4">
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
                                  <TableCell className="p-1 min-w-[300px]">
                                    <FormField control={form.control} name={`items.${index}.producto`} render={({ field: formField }) => (
                                        <SelectorUniversal<Insumo> label="Producto" collectionName="insumos" displayField="descripcion" codeField="codigo" value={formField.value} onSelect={(insumo) => insumo && handleSelectProducto(index, insumo)} searchFields={['descripcion', 'codigo']} />
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
              </Table>
              <Button type="button" variant="outline" size="sm" onClick={() => append({} as any)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto</Button>
            </TabsContent>
            <TabsContent value="financiero" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField name="formaPago" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Forma de Pago</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage/></FormItem> )}/>
                  <FormField name="vencimiento" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Vencimiento</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={form.getValues('formaPago') !== 'Crédito'}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage/></FormItem> )}/>
              </div>
            </TabsContent>
            <TabsContent value="observaciones" className="pt-4">
              <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage/></FormItem> )}/>
            </TabsContent>
        </Tabs>
          
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField name="numeroDocumento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>N° Documento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField name="clienteId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cliente</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger></FormControl><SelectContent>{(clientes || []).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
            <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
            <FormField name="moneda" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PYG">PYG</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
            <FormField name="depositoOrigenId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Depósito de Origen</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un depósito" /></SelectTrigger></FormControl><SelectContent>{(depositos || []).map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gravado 10%:</span><span>{formatCurrency(subtotalIva10 - iva10)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gravado 5%:</span><span>{formatCurrency(subtotalIva5 - iva5)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Exenta:</span><span>{formatCurrency(exenta)}</span></div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA 10%:</span><span>{formatCurrency(iva10)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA 5%:</span><span>{formatCurrency(iva5)}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span className="text-foreground">Total General:</span><span>${formatCurrency(totalGeneral)}</span></div>
            </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit">{venta ? "Guardar Cambios" : "Guardar Venta"}</Button>
        </div>
      </form>
    </Form>
  );
}

"use client";

import { useMemo, useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import type { CompraNormal, Proveedor, Insumo } from "@/lib/types";
import { useCollection, useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

const mercaderiaSchema = z.object({
  insumoId: z.string().nonempty("Debe seleccionar una mercadería."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  valorUnitario: z.coerce.number().positive("El valor debe ser mayor a 0."),
});

const formSchema = z.object({
  // Datos Iniciales
  fechaEmision: z.date({ required_error: "La fecha es obligatoria." }),
  moneda: z.enum(['USD', 'PYG']),
  condicionCompra: z.enum(['Contado', 'Crédito']),
  entidadId: z.string().nonempty("Debe seleccionar un proveedor."),
  formaPago: z.string().optional(),
  totalizadora: z.boolean().default(false),
  observacion: z.string().optional(),

  // Mercaderías
  mercaderias: z.array(mercaderiaSchema).min(1, "Debe agregar al menos una mercadería."),
  
  // Flete
  flete_valor: z.coerce.number().optional(),
  flete_transportadoraId: z.string().optional(),
  flete_datos: z.string().optional(),

  // Financiero
  financiero_cuentaId: z.string().optional(),
  financiero_vencimiento: z.date().optional(),
  
  // Comprobante
  comprobante_documento: z.string().nonempty("El número de documento es obligatorio."),
  comprobante_timbre: z.string().nonempty("El timbre es obligatorio."),
});

type CompraFormValues = z.infer<typeof formSchema>;

interface CompraNormalFormProps {
    compra?: CompraNormal | null;
    onCancel: () => void;
}

export function CompraNormalForm({ compra, onCancel }: CompraNormalFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => firestore ? collection(firestore, 'proveedores') : null, [firestore]));
  
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
      ...compra,
      fechaEmision: new Date(compra.fechaEmision as string),
    } : {
      fechaEmision: new Date(),
      moneda: 'USD',
      condicionCompra: 'Contado',
      totalizadora: false,
      mercaderias: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "mercaderias",
  });

  const watchedMercaderias = form.watch('mercaderias');
  const watchedFlete = form.watch('flete_valor');

  const totalMercaderias = useMemo(() => watchedMercaderias.reduce((acc, item) => {
    return acc + ((item.cantidad || 0) * (item.valorUnitario || 0));
  }, 0), [watchedMercaderias]);
  
  const totalFactura = useMemo(() => totalMercaderias + (watchedFlete || 0), [totalMercaderias, watchedFlete]);


  const handleSubmit = async (data: CompraFormValues) => {
    if (!firestore || !user) return;
    
    const comprasCol = collection(firestore, 'comprasNormal');
    const q = query(comprasCol, orderBy("codigo", "desc"), limit(1));
    const lastDoc = await getDocs(q);
    const nuevoCodigo = lastDoc.empty ? 1 : (lastDoc.docs[0].data().codigo || 0) + 1;

    const compraData: Omit<CompraNormal, 'id'> = {
      codigo: nuevoCodigo,
      fechaEmision: (data.fechaEmision as Date).toISOString(),
      entidadId: data.entidadId,
      moneda: data.moneda,
      formaPago: data.formaPago,
      condicionCompra: data.condicionCompra,
      totalizadora: data.totalizadora,
      observacion: data.observacion,
      totalMercaderias: totalMercaderias,
      totalFlete: data.flete_valor || 0,
      totalFactura: totalFactura,
      estado: 'abierto',
      usuario: user.email || 'N/A',
      timestamp: serverTimestamp(),
      mercaderias: data.mercaderias,
      flete: {
        transportadoraId: data.flete_transportadoraId,
        datos: data.flete_datos,
        valor: data.flete_valor || 0,
      },
      financiero: {
        cuentaId: data.financiero_cuentaId,
        vencimiento: data.financiero_vencimiento,
        valor: totalFactura,
      },
      comprobante: {
        documento: data.comprobante_documento,
        timbre: data.comprobante_timbre,
      }
    };
    
    if (compra) {
      const compraRef = doc(firestore, "comprasNormal", compra.id);
      await updateDocumentNonBlocking(compraRef, compraData);
      toast({ title: "Compra actualizada" });
    } else {
        await addDocumentNonBlocking(comprasCol, compraData);
        toast({ title: "Compra registrada" });
    }
    
    onCancel();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-1">
        <Tabs defaultValue="datos" className="w-full">
          <TabsList>
            <TabsTrigger value="datos">Datos Iniciales</TabsTrigger>
            <TabsTrigger value="mercaderias">Mercaderías</TabsTrigger>
            <TabsTrigger value="flete">Flete</TabsTrigger>
            <TabsTrigger value="financiero">Financiero</TabsTrigger>
            <TabsTrigger value="comprobante">Comprobante</TabsTrigger>
          </TabsList>
          
          <TabsContent value="datos" className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField name="entidadId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Proveedor</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="fechaEmision" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha Emisión</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField name="moneda" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PYG">PYG</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="condicionCompra" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Condición</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="formaPago" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Forma de Pago</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField name="totalizadora" control={form.control} render={({ field }) => (<FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-4 h-full"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Totalizadora</FormLabel><FormMessage /></div></FormItem>)} />
            </div>
            <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="mercaderias" className="space-y-4 pt-4">
              <Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-[350px]">Mercadería</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Valor Unitario</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                      {fields.map((field, index) => (
                          <TableRow key={field.id} className="align-top">
                              <TableCell className="font-medium p-1"><FormField control={form.control} name={`mercaderias.${index}.insumoId`} render={({ field: formField }) => (<FormItem><SelectorUniversal label="Insumo" collectionName="insumos" displayField="nombre" codeField="numeroItem" onSelect={(insumo) => formField.onChange(insumo?.id)} searchFields={['nombre', 'numeroItem']} /><FormMessage /></FormItem> )} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`mercaderias.${index}.cantidad`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`mercaderias.${index}.valorUnitario`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="text-right font-mono p-1 align-middle">${formatCurrency((form.watch(`mercaderias.${index}.cantidad`) || 0) * (form.watch(`mercaderias.${index}.valorUnitario`) || 0))}</TableCell>
                              <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter>
                      <TableRow className="text-base"><TableCell colSpan={3} className="text-right font-bold">Total Mercaderías</TableCell><TableCell className="text-right font-bold font-mono">${formatCurrency(totalMercaderias)}</TableCell><TableCell></TableCell></TableRow>
                  </TableFooter>
              </Table>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ insumoId: "", cantidad: 0, valorUnitario: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem</Button>
          </TabsContent>

          <TabsContent value="flete" className="space-y-6 pt-4">
              <FormField name="flete_transportadoraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Transportadora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione transportadora" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="flete_datos" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Datos del Flete</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="flete_valor" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Valor del Flete</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="financiero" className="space-y-6 pt-4">
              <FormField name="financiero_cuentaId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta de Pago</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="financiero_vencimiento" control={form.control} render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Vencimiento</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              <div className="font-bold text-lg">Valor a Pagar: ${formatCurrency(totalFactura)}</div>
          </TabsContent>
          
          <TabsContent value="comprobante" className="space-y-6 pt-4">
              <FormField name="comprobante_documento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Número de Documento Legal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="comprobante_timbre" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Timbre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-xl font-bold">Total Factura: <span className="font-mono">${formatCurrency(totalFactura)}</span></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit">{compra ? "Guardar Cambios" : "Guardar Compra"}</Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

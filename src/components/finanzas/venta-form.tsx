
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Venta, Parcela, Cultivo, Zafra, Cliente, Insumo } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "../ui/table";
import { SelectorUniversal } from "../common";

const itemSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo."}),
  cantidad: z.coerce.number().positive("La cantidad debe ser un número positivo."),
  precioUnitario: z.coerce.number().positive("El precio debe ser un número positivo."),
});

const formSchema = z.object({
  numeroDocumento: z.string().min(1, "El número de documento es obligatorio."),
  clienteId: z.string().optional(),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  moneda: z.enum(['USD', 'PYG']),
  formaPago: z.enum(['Contado', 'Transferencia', 'Crédito']),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un ítem."),
});


type VentaFormValues = z.infer<typeof formSchema>;

interface VentaFormProps {
  venta?: Partial<Venta> | null;
  onSubmit: (data: Omit<Venta, 'id' | 'total'> & { total: number }) => void;
  onCancel: () => void;
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  clientes: Cliente[];
  insumos: Insumo[];
}

export const VentaForm = React.memo(({ venta, onSubmit, onCancel, parcelas, cultivos, zafras, clientes, insumos }: VentaFormProps) => {
  const form = useForm<VentaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: venta ? {
      ...venta,
      numeroDocumento: venta.numeroDocumento || '',
      moneda: venta.moneda || 'USD',
      formaPago: venta.formaPago || 'Contado',
      fecha: new Date(venta.fecha as string),
    } : {
      fecha: new Date(),
      items: [],
      moneda: 'USD',
      formaPago: 'Contado'
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchedItems = form.watch('items');

  const totalVenta = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => {
        return acc + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0);
    }, 0);
  }, [watchedItems]);

  const handleFinalSubmit = (data: VentaFormValues) => {
    const dataToSave = {
        ...data,
        items: data.items.map(item => ({
            productoId: item.insumo.id, // Aplanar el objeto insumo
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descripcion: item.insumo.descripcion || '',
            descuentoPorc: 0, // No está en el form, default a 0
            subtotal: item.cantidad * item.precioUnitario,
        })),
        total: totalVenta
    };
    onSubmit(dataToSave as any);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFinalSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <FormField control={form.control} name="numeroDocumento" render={({ field }) => ( <FormItem><FormLabel>N° Documento</FormLabel><FormControl><Input placeholder="001-001-000123" {...field} /></FormControl><FormMessage/></FormItem> )}/>
           <FormField control={form.control} name="clienteId" render={({ field }) => ( <FormItem> <FormLabel>Cliente</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger></FormControl> <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
           <FormField control={form.control} name="fecha" render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Fecha de Venta</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={form.control} name="zafraId" render={({ field }) => ( <FormItem> <FormLabel>Zafra</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione la zafra" /></SelectTrigger></FormControl> <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="parcelaId" render={({ field }) => ( <FormItem> <FormLabel>Parcela</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione la parcela" /></SelectTrigger></FormControl> <SelectContent>{parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="cultivoId" render={({ field }) => ( <FormItem> <FormLabel>Cultivo</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Seleccione el cultivo" /></SelectTrigger></FormControl> <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="moneda" render={({ field }) => ( <FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PYG">PYG</SelectItem></SelectContent></Select><FormMessage/></FormItem> )}/>
            <FormField control={form.control} name="formaPago" render={({ field }) => ( <FormItem><FormLabel>Forma de Pago</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage/></FormItem> )}/>
        </div>
        
        <Table>
            <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Cantidad</TableHead><TableHead>Precio Unit.</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
                {fields.map((field, index) => {
                    const item = watchedItems?.[index];
                    const subtotal = (Number(item?.cantidad) || 0) * (Number(item?.precioUnitario) || 0);
                    return (
                        <TableRow key={field.id} className="align-top">
                            <TableCell className="min-w-[300px]"><FormField control={form.control} name={`items.${index}.insumo`} render={({field: formField}) => <SelectorUniversal<Insumo> collectionName="insumos" displayField="nombre" codeField="numeroItem" value={formField.value} onSelect={formField.onChange} searchFields={['nombre', 'numeroItem']} />} /></TableCell>
                            <TableCell><FormField control={form.control} name={`items.${index}.cantidad`} render={({field: formField}) => <Input type="number" {...formField} />} /></TableCell>
                            <TableCell><FormField control={form.control} name={`items.${index}.precioUnitario`} render={({field: formField}) => <Input type="number" {...formField} />} /></TableCell>
                            <TableCell className="text-right font-mono">${formatCurrency(subtotal)}</TableCell>
                            <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
            <TableFooter>
                <TableRow className="text-base"><TableCell colSpan={3} className="text-right font-bold">Total Venta</TableCell><TableCell className="text-right font-bold font-mono">${formatCurrency(totalVenta)}</TableCell><TableCell></TableCell></TableRow>
            </TableFooter>
        </Table>
        <Button type="button" variant="outline" size="sm" onClick={() => append({} as any)}><PlusCircle className="mr-2 h-4 w-4"/>Agregar Producto</Button>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{venta?.id ? "Guardar Cambios" : "Crear Venta"}</Button>
        </div>
      </form>
    </Form>
  );
});

VentaForm.displayName = 'VentaForm';

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Compra, Proveedor, Insumo, MovimientoStock } from "@/lib/types";
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { InsumoSelector } from "@/components/insumos/InsumoSelector";
import { useMemo } from "react";

const itemSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo válido." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio debe ser mayor a 0."),
  porcentajeIva: z.enum(['0', '5', '10']),
});

const formSchema = z.object({
  proveedorId: z.string().nonempty("Debe seleccionar un proveedor."),
  tipoCompra: z.enum(['Externa', 'Interna']),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  numeroDocumento: z.string().min(3, "El número de documento es muy corto."),
  tipoDocumento: z.enum(['Factura', 'Nota de Crédito', 'Remisión']),
  condicion: z.enum(['Contado', 'Crédito']),
  observacion: z.string().optional(),
  items: z.array(itemSchema).min(1, "Debe agregar al menos un ítem."),
});

type CompraFormValues = z.infer<typeof formSchema>;

interface CompraFormProps {
    compra?: Compra | null;
}


export function CompraForm({ compra }: CompraFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const proveedoresQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'proveedores'), orderBy('nombre')) : null, [firestore]);
  const { data: proveedores } = useCollection<Proveedor>(proveedoresQuery);
  
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
      ...compra,
      fecha: new Date(compra.fecha as string),
    } : {
      tipoDocumento: 'Factura',
      condicion: 'Contado',
      tipoCompra: 'Externa',
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch('items');
  const totalGeneral = useMemo(() => {
    return watchedItems.reduce((total, item) => {
        const cantidad = item.cantidad || 0;
        const precio = item.precioUnitario || 0;
        return total + (cantidad * precio);
    }, 0)
  }, [watchedItems]);


  const handleSubmit = async (data: CompraFormValues) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);

    // 1. Crear el documento de Compra
    const compraRef = doc(collection(firestore, 'compras'));
    const total = data.items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const compraData: Omit<Compra, 'id'> = {
        ...data,
        fecha: data.fecha.toISOString(),
        total,
        estado: 'Registrado',
        creadoPor: user.uid,
        creadoEn: serverTimestamp(),
        items: data.items.map(item => ({...item, insumoId: item.insumo.id}))
    };
    batch.set(compraRef, compraData);

    // 2. Procesar cada item para actualizar stock y costo promedio, y registrar movimiento
    for (const item of data.items) {
        const insumoRef = doc(firestore, 'insumos', item.insumo.id);
        const insumoDoc = await getDoc(insumoRef);
        if (!insumoDoc.exists()) {
            toast({ variant: 'destructive', title: `Error: Insumo ${item.insumo.nombre} no encontrado.` });
            return;
        }

        const insumoActual = insumoDoc.data() as Insumo;
        
        // --- Actualizar Stock ---
        const stockActual = insumoActual.stockActual || 0;
        const nuevoStock = stockActual + item.cantidad;

        // --- Calcular Nuevo Costo Promedio Ponderado ---
        const precioPromedioActual = insumoActual.precioPromedioCalculado || 0;
        const nuevoCostoPromedio = (stockActual + item.cantidad) > 0
            ? ((stockActual * precioPromedioActual) + (item.cantidad * item.precioUnitario)) / (stockActual + item.cantidad)
            : item.precioUnitario;

        batch.update(insumoRef, {
            stockActual: nuevoStock,
            precioPromedioCalculado: nuevoCostoPromedio,
            ultimaCompra: serverTimestamp()
        });

        // --- Registrar Movimiento de Stock ---
        const movimientoRef = doc(collection(firestore, 'MovimientosStock'));
        const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
            fecha: data.fecha,
            tipo: "entrada",
            origen: "compra",
            compraId: compraRef.id,
            insumoId: item.insumo.id,
            insumoNombre: item.insumo.nombre,
            unidad: item.insumo.unidad,
            categoria: item.insumo.categoria,
            cantidad: item.cantidad,
            stockAntes: stockActual,
            stockDespues: nuevoStock,
            precioUnitario: item.precioUnitario,
            costoTotal: item.cantidad * item.precioUnitario,
            creadoPor: user.uid,
            creadoEn: new Date(),
        };
        batch.set(movimientoRef, nuevoMovimiento);
    }

    try {
        await batch.commit();
        toast({
            title: "Compra registrada con éxito",
            description: `La compra con N° ${data.numeroDocumento} ha sido guardada.`,
        });
        router.push("/comercial/compras");
    } catch (error) {
        console.error("Error al guardar la compra: ", error);
        toast({
            variant: "destructive",
            title: "Error al guardar la compra",
            description: "No se pudieron procesar todas las operaciones."
        })
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Datos de la Compra</CardTitle>
                    <CardDescription>Información general del documento de compra.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField name="proveedorId" control={form.control} render={({ field }) => (<FormItem><FormLabel>Proveedor</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField name="tipoCompra" control={form.control} render={({ field }) => (<FormItem><FormLabel>Tipo de Compra</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Externa">Externa</SelectItem><SelectItem value="Interna">Interna</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FormField name="fecha" control={form.control} render={({ field }) => (<FormItem className="flex flex-col pt-2"><FormLabel>Fecha de Emisión</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        <FormField name="tipoDocumento" control={form.control} render={({ field }) => (<FormItem><FormLabel>Tipo de Documento</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Factura">Factura</SelectItem><SelectItem value="Nota de Crédito">Nota de Crédito</SelectItem><SelectItem value="Remisión">Remisión</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField name="numeroDocumento" control={form.control} render={({ field }) => (<FormItem><FormLabel>Número Documento</FormLabel><FormControl><Input placeholder="001-001-0123456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField name="condicion" control={form.control} render={({ field }) => (<FormItem><FormLabel>Condición</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Notas adicionales sobre la compra..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ítems de la Compra</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const item = watchedItems[index];
                            const totalItem = (item?.cantidad || 0) * (item?.precioUnitario || 0);

                            return (
                                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-md relative">
                                    <div className="md:col-span-4">
                                        <FormField
                                            name={`items.${index}.insumo`}
                                            control={form.control}
                                            render={({ field: controllerField, fieldState }) => (
                                                <FormItem>
                                                    <FormLabel>Insumo</FormLabel>
                                                    <InsumoSelector
                                                        value={controllerField.value}
                                                        onChange={(insumo) => controllerField.onChange(insumo)}
                                                    />
                                                    {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-2"><FormField name={`items.${index}.cantidad`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                                    <div className="md:col-span-2"><FormField name={`items.${index}.precioUnitario`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Precio Unitario</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                                    <div className="md:col-span-2"><FormField name={`items.${index}.porcentajeIva`} control={form.control} render={({ field }) => (<FormItem><FormLabel>IVA</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="10">10%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="0">Exento</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} /></div>
                                    <div className="md:col-span-1 flex items-center">
                                      <p className="font-mono font-semibold text-lg text-right w-full">${totalItem.toLocaleString('en-US')}</p>
                                    </div>
                                    <div className="md:col-span-1 flex justify-end">
                                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-5 w-5" /></Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ insumo: undefined, cantidad: 0, precioUnitario: 0, porcentajeIva: '10' })}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem</Button>
                </CardContent>
                <CardFooter className="flex justify-end bg-muted/50 p-4">
                    <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold">Total General:</span>
                        <span className="text-2xl font-bold font-mono text-primary">${totalGeneral.toLocaleString('en-US')}</span>
                    </div>
                </CardFooter>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Compra</Button>
            </div>
          </form>
        </Form>
    </>
  );
}

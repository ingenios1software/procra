"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Compra, Proveedor, Insumo, MovimientoStock, Zafra } from "@/lib/types";
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useMemo } from "react";
import { TablaItemsCompra } from "./TablaItemsCompra";

const itemSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo válido." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio debe ser mayor a 0."),
  porcentajeIva: z.enum(['0', '5', '10']),
});

const formSchema = z.object({
  proveedorId: z.string().nonempty("Debe seleccionar un proveedor."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
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
  const zafrasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]);
  const { data: zafras } = useCollection<Zafra>(zafrasQuery);
  
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
      fecha: new Date(),
    },
  });

  const { fields, append, remove } = useFieldArray({
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

    for (const item of data.items) {
        const insumoRef = doc(firestore, 'insumos', item.insumo.id);
        const insumoDoc = await getDoc(insumoRef);
        if (!insumoDoc.exists()) {
            toast({ variant: 'destructive', title: `Error: Insumo ${item.insumo.nombre} no encontrado.` });
            return;
        }

        const insumoActual = insumoDoc.data() as Insumo;
        
        const stockActual = insumoActual.stockActual || 0;
        const nuevoStock = stockActual + item.cantidad;

        const precioPromedioActual = insumoActual.precioPromedioCalculado || insumoActual.costoUnitario || 0;
        const nuevoCostoPromedio = (stockActual + item.cantidad) > 0
            ? ((stockActual * precioPromedioActual) + (item.cantidad * item.precioUnitario)) / (stockActual + item.cantidad)
            : item.precioUnitario;

        batch.update(insumoRef, {
            stockActual: nuevoStock,
            precioPromedioCalculado: nuevoCostoPromedio,
            ultimaCompra: serverTimestamp()
        });

        const movimientoRef = doc(collection(firestore, 'MovimientosStock'));
        const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
            fecha: data.fecha,
            tipo: "entrada",
            origen: "compra",
            compraId: compraRef.id,
            zafraId: data.zafraId,
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
                      <FormField name="zafraId" control={form.control} render={({ field }) => (<FormItem><FormLabel>Zafra</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl><SelectContent>{zafras?.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
                    <TablaItemsCompra
                        fields={fields}
                        append={append}
                        remove={remove}
                        form={form}
                    />
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

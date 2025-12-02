"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Compra, Proveedor, Insumo } from "@/lib/types";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

const itemSchema = z.object({
  insumoId: z.string().nonempty("Debe seleccionar un insumo."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio debe ser mayor a 0."),
  porcentajeIva: z.enum(['0', '5', '10']),
});

const formSchema = z.object({
  proveedorId: z.string().nonempty("Debe seleccionar un proveedor."),
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

  const proveedoresQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'proveedores'), orderBy('nombre')) : null, [firestore]);
  const { data: proveedores } = useCollection<Proveedor>(proveedoresQuery);

  const insumosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos'), orderBy('nombre')) : null, [firestore]);
  const { data: insumos } = useCollection<Insumo>(insumosQuery);
  
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
      ...compra,
      fecha: new Date(compra.fecha),
    } : {
      tipoDocumento: 'Factura',
      condicion: 'Contado',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const handleSubmit = (data: CompraFormValues) => {
    if (!firestore) return;

    const total = data.items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const dataToSave = {
      ...data,
      fecha: data.fecha.toISOString(),
      total,
      estado: 'Registrado'
    };

    const comprasCol = collection(firestore, 'compras');
    addDocumentNonBlocking(comprasCol, dataToSave);
    
    toast({
      title: "Compra registrada",
      description: `La compra con N° ${data.numeroDocumento} ha sido guardada.`,
    });
    router.push("/comercial/compras");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="proveedorId" control={form.control} render={({ field }) => (<FormItem><FormLabel>Proveedor</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField name="fecha" control={form.control} render={({ field }) => (<FormItem className="flex flex-col pt-2"><FormLabel>Fecha de Emisión</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FormField name="tipoDocumento" control={form.control} render={({ field }) => (<FormItem><FormLabel>Tipo de Documento</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Factura">Factura</SelectItem><SelectItem value="Nota de Crédito">Nota de Crédito</SelectItem><SelectItem value="Remisión">Remisión</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField name="numeroDocumento" control={form.control} render={({ field }) => (<FormItem><FormLabel>Número Documento</FormLabel><FormControl><Input placeholder="001-001-0123456" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="condicion" control={form.control} render={({ field }) => (<FormItem><FormLabel>Condición</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Contado">Contado</SelectItem><SelectItem value="Crédito">Crédito</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Items de la Compra</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-end gap-4 p-4 border rounded-md">
                                <FormField name={`items.${index}.insumoId`} control={form.control} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Insumo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{insumos?.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField name={`items.${index}.cantidad`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`items.${index}.precioUnitario`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Precio Unitario</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`items.${index}.porcentajeIva`} control={form.control} render={({ field }) => (<FormItem><FormLabel>IVA</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="10">10%</SelectItem><SelectItem value="5">5%</SelectItem><SelectItem value="0">Exento</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ insumoId: '', cantidad: 0, precioUnitario: 0, porcentajeIva: '10' })}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem</Button>
                </CardContent>
            </Card>

            <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Notas adicionales sobre la compra..." {...field} /></FormControl><FormMessage /></FormItem> )} />
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Compra</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

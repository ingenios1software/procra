
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
import type { CompraNormal, Proveedor, Insumo, MovimientoStock, LoteInsumo, AsientoDiario, PlanDeCuenta } from "@/lib/types";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

const mercaderiaSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar una mercadería." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  valorUnitario: z.coerce.number().positive("El valor debe ser mayor a 0."),
  lote: z.string().optional(),
  sinVencimiento: z.boolean().optional(),
  fechaVencimiento: z.date().optional(),
});

const formSchema = z.object({
  // Datos Iniciales
  fechaEmision: z.date({ required_error: "La fecha es obligatoria." }),
  moneda: z.enum(['USD', 'PYG']),
  condicionCompra: z.enum(['Contado', 'Crédito']).default('Crédito'),
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
  financiero_cuentaInventarioId: z.string().nonempty('Seleccione la cuenta de inventario/gasto.'),
  financiero_cuentaPorPagarId: z.string().nonempty('Seleccione la cuenta por pagar.'),
  financiero_vencimiento: z.date().optional(),
  
  // Comprobante
  comprobante_documento: z.string().nonempty("El número de documento es obligatorio."),
  comprobante_timbre: z.string().nonempty("El timbre es obligatorio."),
}).refine(data => data.condicionCompra === 'Crédito', {
  message: 'En este flujo las compras se registran como crédito.',
  path: ['condicionCompra'],
});

type CompraFormValues = z.infer<typeof formSchema>;

interface CompraNormalFormProps {
    compra?: CompraNormal | null;
    onCancel: () => void;
}

export function CompraNormalForm({ compra, onCancel }: CompraNormalFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => firestore ? collection(firestore, 'proveedores') : null, [firestore]));
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(useMemoFirebase(() => firestore ? query(collection(firestore, 'planDeCuentas'), orderBy('codigo')) : null, [firestore]));
  
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
      // Mapeo explícito para evitar problemas de anidamiento y tipos
      fechaEmision: new Date(compra.fechaEmision as string),
      moneda: compra.moneda,
      condicionCompra: "Crédito",
      entidadId: compra.entidadId,
      formaPago: compra.formaPago || undefined,
      totalizadora: compra.totalizadora,
      observacion: compra.observacion ?? undefined, // FIX: `null` becomes `undefined`
      
      mercaderias: compra.mercaderias.map(m => ({...m, insumo: m.insumo || m, fechaVencimiento: m.fechaVencimiento ? new Date(m.fechaVencimiento as string) : undefined, sinVencimiento: m.sinVencimiento || false })),
      
      flete_valor: compra.flete?.valor || undefined,
      flete_transportadoraId: compra.flete?.transportadoraId || undefined,
      flete_datos: compra.flete?.datos || undefined,

      financiero_cuentaId: compra.financiero?.cuentaId || undefined,
      financiero_cuentaInventarioId: compra.financiero?.cuentaInventarioId || '',
      financiero_cuentaPorPagarId: compra.financiero?.cuentaPorPagarId || '',
      financiero_vencimiento: compra.financiero?.vencimiento ? new Date(compra.financiero.vencimiento as string) : undefined,
      
      comprobante_documento: compra.comprobante.documento,
      comprobante_timbre: compra.comprobante.timbre,
    } : {
      fechaEmision: new Date(),
      moneda: 'USD',
      condicionCompra: 'Crédito',
      totalizadora: false,
      mercaderias: [],
      financiero_cuentaInventarioId: '',
      financiero_cuentaPorPagarId: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "mercaderias",
  });

  const watchedMercaderias = useWatch({
    control: form.control,
    name: 'mercaderias',
  });
  const watchedFlete = useWatch({
    control: form.control,
    name: 'flete_valor',
  });

  const totalMercaderias = useMemo(() => {
    return (watchedMercaderias || []).reduce((acc, item) => {
        return acc + ((Number(item.cantidad) || 0) * (Number(item.valorUnitario) || 0));
    }, 0);
  }, [watchedMercaderias]);
  
  const totalFactura = useMemo(() => {
    return totalMercaderias + (Number(watchedFlete) || 0);
  }, [totalMercaderias, watchedFlete]);

  const handleSubmit = async (data: CompraFormValues) => {
    if (!firestore || !user) {
        toast({ variant: "destructive", title: "Error de autenticación." });
        return;
    }

    const batch = writeBatch(firestore);

    // --- 1. PREPARAR DOCUMENTO DE COMPRA ---
    const comprasCol = collection(firestore, 'comprasNormal');
    const compraRef = compra ? doc(firestore, "comprasNormal", compra.id) : doc(comprasCol);
    
    let nuevoCodigo = compra?.codigo;
    if (!nuevoCodigo) {
        const q = query(comprasCol, orderBy("codigo", "desc"), limit(1));
        const lastDoc = await getDocs(q);
        nuevoCodigo = lastDoc.empty ? 1 : (lastDoc.docs[0].data().codigo || 0) + 1;
    }

    const compraData: Omit<CompraNormal, 'id'> = {
        codigo: nuevoCodigo,
        fechaEmision: (data.fechaEmision as Date).toISOString(),
        entidadId: data.entidadId,
        moneda: data.moneda,
        formaPago: data.formaPago,
        condicionCompra: 'Crédito',
        totalizadora: data.totalizadora,
        observacion: data.observacion || null,
        totalMercaderias: totalMercaderias,
        totalFlete: data.flete_valor || 0,
        totalFactura: totalFactura,
        estado: compra?.estado || 'abierto',
        usuario: user.email || 'N/A',
        timestamp: serverTimestamp(),
        mercaderias: data.mercaderias.map(m => ({ insumoId: m.insumo.id, cantidad: m.cantidad, valorUnitario: m.valorUnitario, lote: m.lote?.trim() || undefined, fechaVencimiento: m.fechaVencimiento ? m.fechaVencimiento.toISOString() : undefined, sinVencimiento: Boolean(m.sinVencimiento) })),
        flete: { valor: data.flete_valor || 0, transportadoraId: data.flete_transportadoraId, datos: data.flete_datos },
        financiero: {
          valor: totalFactura,
          cuentaId: data.financiero_cuentaId,
          cuentaInventarioId: data.financiero_cuentaInventarioId,
          cuentaPorPagarId: data.financiero_cuentaPorPagarId,
          pagoAplicado: compra?.financiero?.pagoAplicado || false,
          cuentaPagoId: compra?.financiero?.cuentaPagoId,
          asientoPagoId: compra?.financiero?.asientoPagoId,
          fechaPago: compra?.financiero?.fechaPago,
          vencimiento: data.financiero_vencimiento ? data.financiero_vencimiento.toISOString() : undefined
        },
        comprobante: { documento: data.comprobante_documento, timbre: data.comprobante_timbre }
    };
    
    if (compra) {
        batch.update(compraRef, compraData as any);
    } else {
        batch.set(compraRef, compraData);
    }

    // --- 2. PROCESAR MOVIMIENTOS DE STOCK (SI APLICA) ---
    if (!data.totalizadora) {
        for (const item of data.mercaderias) {
            const insumoComprado = item.insumo as Insumo;
            const insumoRef = doc(firestore, "insumos", insumoComprado.id);
            
            // Leer el estado actual del insumo
            const insumoDoc = await getDoc(insumoRef);
            if (!insumoDoc.exists()) continue; 
            const insumoActual = insumoDoc.data() as Insumo;

            const stockAnterior = insumoActual.stockActual || 0;
            const cantidadCompra = item.cantidad;
            const nuevoStock = stockAnterior + cantidadCompra;
            
            // Calcular precio promedio ponderado
            const precioAnterior = insumoActual.precioPromedioCalculado || insumoActual.costoUnitario || 0;
            const precioCompra = item.valorUnitario;
            const nuevoPrecioPromedio = (stockAnterior + cantidadCompra > 0)
                ? (stockAnterior * precioAnterior + cantidadCompra * precioCompra) / (stockAnterior + cantidadCompra)
                : precioCompra;

            // Actualizar el documento del insumo
            batch.update(insumoRef, {
                stockActual: nuevoStock,
                precioPromedioCalculado: nuevoPrecioPromedio,
                costoUnitario: precioCompra, // Guardamos el último costo
                ultimaCompra: data.fechaEmision.toISOString(),
            });

            const loteCodigo = item.lote?.trim();
            const controlaLotes = Boolean(insumoActual.controlaLotes);
            if (controlaLotes && loteCodigo) {
                const loteRef = doc(collection(firestore, 'lotesInsumos'));
                const loteData: Omit<LoteInsumo, 'id'> = {
                    insumoId: insumoComprado.id,
                    codigoLote: loteCodigo,
                    fechaIngreso: data.fechaEmision.toISOString(),
                    fechaVencimiento: item.sinVencimiento ? null : (item.fechaVencimiento ? item.fechaVencimiento.toISOString() : null),
                    cantidadInicial: cantidadCompra,
                    cantidadDisponible: cantidadCompra,
                    estado: 'activo',
                    origen: 'compra',
                    origenId: compraRef.id,
                    creadoPor: user.uid,
                    creadoEn: new Date().toISOString(),
                };
                batch.set(loteRef, loteData);
            }

            // Crear movimiento de stock
            const movimientoRef = doc(collection(firestore, "MovimientosStock"));
            const movimientoData: Omit<MovimientoStock, 'id'> = {
                fecha: data.fechaEmision,
                tipo: 'entrada',
                origen: 'compra',
                compraId: compraRef.id,
                insumoId: insumoComprado.id,
                insumoNombre: insumoComprado.nombre,
                unidad: insumoComprado.unidad,
                categoria: insumoComprado.categoria,
                cantidad: cantidadCompra,
                stockAntes: stockAnterior,
                stockDespues: nuevoStock,
                precioUnitario: precioCompra,
                costoTotal: cantidadCompra * precioCompra,
                lote: item.lote?.trim() || undefined,
                loteVencimiento: item.sinVencimiento ? null : (item.fechaVencimiento ? item.fechaVencimiento.toISOString() : null),
                creadoPor: user.uid,
                creadoEn: new Date(),
            };
            batch.set(movimientoRef, movimientoData);
        }
    }


    if (!compra) {
      const asientoCompraRef = doc(collection(firestore, "asientosDiario"));
      const asientoCompra: Omit<AsientoDiario, 'id'> = {
        fecha: data.fechaEmision.toISOString(),
        descripcion: `Compra crédito doc ${data.comprobante_documento}`,
        movimientos: [
          { cuentaId: data.financiero_cuentaInventarioId, tipo: 'debe', monto: totalFactura },
          { cuentaId: data.financiero_cuentaPorPagarId, tipo: 'haber', monto: totalFactura },
        ],
      };
      batch.set(asientoCompraRef, asientoCompra);
      (compraData.financiero as any).asientoRegistroId = asientoCompraRef.id;
    }

    // --- 3. COMMIT DE LA TRANSACCIÓN ---
    try {
        await batch.commit();
        toast({ title: compra ? "Compra actualizada con éxito" : "Compra registrada con éxito" });
        onCancel();
    } catch (e: any) {
        console.error("Error al guardar la compra y actualizar stock:", e);
        toast({ variant: "destructive", title: "Error al guardar", description: e.message });
    }
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
                <FormItem><FormLabel>Condición</FormLabel><div className="rounded-md border px-3 py-2 text-sm">Crédito (flujo contable)</div></FormItem>
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
                      <TableHead>Lote</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                      {fields.map((field, index) => {
                          const item = watchedMercaderias?.[index];
                          const cantidad = item?.cantidad || 0;
                          const valorUnitario = item?.valorUnitario || 0;
                          const valorTotal = cantidad * valorUnitario;
                          return (
                          <TableRow key={field.id} className="align-top">
                              <TableCell className="font-medium p-1">
                                <FormField 
                                    control={form.control} 
                                    name={`mercaderias.${index}.insumo`} 
                                    render={({ field: formField }) => (
                                      <FormItem>
                                        <SelectorUniversal<Insumo> 
                                            label="Insumo" 
                                            collectionName="insumos" 
                                            displayField="nombre" 
                                            codeField="numeroItem" 
                                            value={formField.value} 
                                            onSelect={(insumo) => form.setValue(`mercaderias.${index}.insumo`, insumo)} 
                                            searchFields={['nombre', 'numeroItem']} />
                                        <FormMessage />
                                      </FormItem> 
                                    )} 
                                />
                              </TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`mercaderias.${index}.cantidad`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`mercaderias.${index}.valorUnitario`} render={({ field: formField }) => <Input type="number" {...formField} />} /></TableCell>
                              <TableCell className="p-1"><FormField control={form.control} name={`mercaderias.${index}.lote`} render={({ field: formField }) => <Input placeholder="Opcional" {...formField} />} /></TableCell>
                              <TableCell className="p-1">
                                <FormField control={form.control} name={`mercaderias.${index}.fechaVencimiento`} render={({ field: formField }) => (
                                  <Input type="date" value={formField.value ? format(formField.value, 'yyyy-MM-dd') : ''} onChange={(e) => formField.onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined)} />
                                )} />
                              </TableCell>
                              <TableCell className="text-right font-mono p-1 align-middle">${formatCurrency(valorTotal)}</TableCell>
                              <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                      )})}
                  </TableBody>
                  <TableFooter>
                      <TableRow className="text-base"><TableCell colSpan={5} className="text-right font-bold">Total Mercaderías</TableCell><TableCell className="text-right font-bold font-mono">${formatCurrency(totalMercaderias)}</TableCell><TableCell></TableCell></TableRow>
                  </TableFooter>
              </Table>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ insumo: undefined, cantidad: 0, valorUnitario: 0, lote: '', sinVencimiento: false })}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem</Button>
          </TabsContent>

          <TabsContent value="flete" className="space-y-6 pt-4">
              <FormField name="flete_transportadoraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Transportadora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione transportadora" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="flete_datos" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Datos del Flete</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="flete_valor" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Valor del Flete</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="financiero" className="space-y-6 pt-4">
              <FormField name="financiero_cuentaInventarioId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta de Inventario/Gasto (Debe)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una cuenta" /></SelectTrigger></FormControl><SelectContent>{planDeCuentas?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="financiero_cuentaPorPagarId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta por Pagar (Haber)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una cuenta" /></SelectTrigger></FormControl><SelectContent>{planDeCuentas?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="financiero_cuentaId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta sugerida para pago futuro (opcional)</FormLabel><FormControl><Input placeholder="Referencia interna" {...field} /></FormControl><FormMessage /></FormItem> )} />
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

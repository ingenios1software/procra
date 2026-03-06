
"use client";

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import type {
  CompraNormal,
  Proveedor,
  Insumo,
  MovimientoStock,
  LoteInsumo,
  AsientoDiario,
  PlanDeCuenta,
  CuentaPorPagar,
  Zafra,
} from "@/lib/types";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from '@/lib/contabilidad/cuentas-base';
import { calcularEstadoCuenta } from "@/lib/cuentas";
import { resolveZafraContext, withZafraContext } from "@/lib/contabilidad/asientos";

const mercaderiaSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar una mercaderia." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  valorUnitario: z.coerce.number().positive("El valor debe ser mayor a 0."),
  lote: z.string().optional(),
  sinVencimiento: z.boolean().optional(),
  fechaVencimiento: z.date().optional(),
});

const formSchema = z.object({
  // Datos Iniciales
  fechaEmision: z.date({ required_error: "La fecha es obligatoria." }),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  moneda: z.enum(['USD', 'PYG']),
  condicionCompra: z.enum(['Contado', 'Cr\u00E9dito']).default('Cr\u00E9dito'),
  entidadId: z.string().nonempty("Debe seleccionar un proveedor."),
  formaPago: z.string().optional(),
  totalizadora: z.boolean().default(false),
  observacion: z.string().optional(),

  // Mercaderias
  mercaderias: z.array(mercaderiaSchema).min(1, "Debe agregar al menos una mercaderia."),
  
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
  comprobante_documento: z.string().nonempty("El numero de documento es obligatorio."),
  comprobante_timbre: z.string().nonempty("El timbre es obligatorio."),
}).refine(data => data.condicionCompra === 'Cr\u00E9dito', {
  message: 'En este flujo las compras se registran como credito.',
  path: ['condicionCompra'],
});

type CompraFormValues = z.infer<typeof formSchema>;
type FormMode = 'create' | 'edit' | 'view';

function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }
  if (value && typeof value === "object" && (value as any).constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) continue;
      result[key] = omitUndefinedDeep(nestedValue);
    }
    return result as T;
  }
  return value;
}

function dateToInputValue(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface CompraNormalFormProps {
    compra?: CompraNormal | null;
    mode?: FormMode;
    onCancel: () => void;
}

export function CompraNormalForm({ compra, mode = 'create', onCancel }: CompraNormalFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  const isViewMode = mode === 'view';
  const isEditingExisting = mode === 'edit' && Boolean(compra);
  const lockTransactionalFields = Boolean(compra);
  const disableReadonlyOrSaving = isViewMode || isSaving;
  const disableTransactional = disableReadonlyOrSaving || lockTransactionalFields;
  const disableZafraSelection = disableReadonlyOrSaving;

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => firestore ? collection(firestore, 'proveedores') : null, [firestore]));
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(useMemoFirebase(() => firestore ? query(collection(firestore, 'planDeCuentas'), orderBy('codigo')) : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]));
  
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: compra ? {
      // Mapeo explicito para evitar problemas de anidamiento y tipos
      fechaEmision: new Date(compra.fechaEmision as string),
      zafraId: compra.zafraId || "",
      moneda: compra.moneda,
      condicionCompra: "Cr\u00E9dito",
      entidadId: compra.entidadId,
      formaPago: compra.formaPago || undefined,
      totalizadora: compra.totalizadora,
      observacion: compra.observacion ?? undefined, // FIX: `null` becomes `undefined`
      
      mercaderias: compra.mercaderias.map(m => ({...m, insumo: m.insumo || ({ id: m.insumoId, nombre: m.insumoId } as Insumo), fechaVencimiento: m.fechaVencimiento ? new Date(m.fechaVencimiento as string) : undefined, sinVencimiento: m.sinVencimiento || false })),
      
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
      zafraId: '',
      moneda: 'USD',
      condicionCompra: 'Cr\u00E9dito',
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

  useEffect(() => {
    if (compra || !planDeCuentas || planDeCuentas.length === 0) return;

    const cuentaInventarioActual = form.getValues("financiero_cuentaInventarioId");
    const cuentaPorPagarActual = form.getValues("financiero_cuentaPorPagarId");

    if (!cuentaInventarioActual) {
      const inventario =
        findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.INVENTARIO) ||
        planDeCuentas.find((c) => c.tipo === "activo" && c.naturaleza === "deudora");
      if (inventario?.id) {
        form.setValue("financiero_cuentaInventarioId", inventario.id, { shouldValidate: true });
      }
    }

    if (!cuentaPorPagarActual) {
      const proveedores =
        findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.PROVEEDORES) ||
        planDeCuentas.find((c) => c.tipo === "pasivo" && c.naturaleza === "acreedora");
      if (proveedores?.id) {
        form.setValue("financiero_cuentaPorPagarId", proveedores.id, { shouldValidate: true });
      }
    }
  }, [compra, form, planDeCuentas]);

  const handleSubmit = async (data: CompraFormValues) => {
    if (isViewMode || isSaving) return;
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error de autenticacion." });
      return;
    }

    setIsSaving(true);
    try {
      const zafraContext = resolveZafraContext(
        zafras,
        data.zafraId,
        compra?.zafraNombre || compra?.planFinanciacion || null
      );
      const batch = writeBatch(firestore);
      const comprasCol = collection(firestore, "comprasNormal");
      const compraRef = compra ? doc(firestore, "comprasNormal", compra.id) : doc(comprasCol);
      const cuentaPorPagarRef = doc(firestore, "cuentasPorPagar", compraRef.id);
      const shouldCreateWorkflowEntries = !compra;
      const shouldApplyStock = shouldCreateWorkflowEntries && !data.totalizadora;

      let cuentaPorPagarActual: CuentaPorPagar | null = null;
      const cuentaPorPagarSnap = await getDoc(cuentaPorPagarRef);
      if (cuentaPorPagarSnap.exists()) {
        cuentaPorPagarActual = { ...(cuentaPorPagarSnap.data() as CuentaPorPagar), id: cuentaPorPagarSnap.id };
      }

      let nuevoCodigo = compra?.codigo;
      if (!nuevoCodigo) {
        const q = query(comprasCol, orderBy("codigo", "desc"), limit(1));
        const lastDoc = await getDocs(q);
        const maxCode = Number(lastDoc.docs[0]?.data()?.codigo || 0);
        nuevoCodigo = Number.isFinite(maxCode) ? maxCode + 1 : 1;
      }

      let asientoRegistroId = compra?.financiero?.asientoRegistroId;
      if (shouldCreateWorkflowEntries) {
        const asientoCompraRef = doc(collection(firestore, "asientosDiario"));
        const asientoCompra: Omit<AsientoDiario, "id"> = withZafraContext({
          fecha: data.fechaEmision.toISOString(),
          descripcion: `Compra credito doc ${data.comprobante_documento}`,
          movimientos: [
            { cuentaId: data.financiero_cuentaInventarioId, tipo: "debe", monto: totalFactura },
            { cuentaId: data.financiero_cuentaPorPagarId, tipo: "haber", monto: totalFactura },
          ],
        }, zafraContext);
        batch.set(asientoCompraRef, asientoCompra);
        asientoRegistroId = asientoCompraRef.id;
      } else if (asientoRegistroId) {
        batch.set(
          doc(firestore, "asientosDiario", asientoRegistroId),
          withZafraContext({}, zafraContext),
          { merge: true }
        );
      }

      const compraData: Omit<CompraNormal, "id"> = {
        codigo: nuevoCodigo,
        fechaEmision: data.fechaEmision.toISOString(),
        zafraId: data.zafraId,
        zafraNombre: zafraContext.zafraNombre || null,
        planFinanciacion: zafraContext.zafraNombre || undefined,
        entidadId: data.entidadId,
        moneda: data.moneda,
        formaPago: data.formaPago,
        condicionCompra: "Cr\u00E9dito",
        totalizadora: data.totalizadora,
        observacion: data.observacion || null,
        totalMercaderias,
        totalFlete: data.flete_valor || 0,
        totalFactura,
        estado: compra?.estado || "abierto",
        usuario: user.email || "N/A",
        timestamp: serverTimestamp(),
        mercaderias: data.mercaderias.map((m) => ({
          insumoId: m.insumo.id,
          cantidad: Number(m.cantidad) || 0,
          valorUnitario: Number(m.valorUnitario) || 0,
          lote: m.lote?.trim() || undefined,
          fechaVencimiento: m.fechaVencimiento ? m.fechaVencimiento.toISOString() : undefined,
          sinVencimiento: Boolean(m.sinVencimiento),
        })),
        flete: { valor: data.flete_valor || 0, transportadoraId: data.flete_transportadoraId, datos: data.flete_datos },
        financiero: {
          valor: totalFactura,
          cuentaId: data.financiero_cuentaId,
          cuentaInventarioId: data.financiero_cuentaInventarioId,
          cuentaPorPagarId: data.financiero_cuentaPorPagarId,
          pagoAplicado: compra?.financiero?.pagoAplicado || false,
          cuentaPagoId: compra?.financiero?.cuentaPagoId,
          asientoRegistroId,
          asientoPagoId: compra?.financiero?.asientoPagoId,
          fechaPago: compra?.financiero?.fechaPago,
          vencimiento: data.financiero_vencimiento ? data.financiero_vencimiento.toISOString() : undefined
        },
        comprobante: { documento: data.comprobante_documento, timbre: data.comprobante_timbre }
      };

      const compraDataSanitized = omitUndefinedDeep(compraData);
      if (compra) {
        batch.update(compraRef, compraDataSanitized as any);
      } else {
        batch.set(compraRef, compraDataSanitized);
      }

      const montoOriginal = Number(cuentaPorPagarActual?.montoOriginal ?? totalFactura) || 0;
      const montoPagado = Number(cuentaPorPagarActual?.montoPagado ?? 0) || 0;
      const saldoPendiente = Number(cuentaPorPagarActual?.saldoPendiente ?? totalFactura) || 0;
      const fechaVencimiento = data.financiero_vencimiento ? data.financiero_vencimiento.toISOString() : undefined;
      const estado = calcularEstadoCuenta({
        montoOriginal,
        saldoPendiente,
        fechaVencimiento,
      });

      const cuentaPorPagarData: Omit<CuentaPorPagar, "id"> = {
        compraId: compraRef.id,
        compraDocumento: data.comprobante_documento,
        proveedorId: data.entidadId,
        zafraId: data.zafraId,
        zafraNombre: zafraContext.zafraNombre || null,
        fechaEmision: data.fechaEmision.toISOString(),
        fechaVencimiento,
        moneda: data.moneda,
        montoOriginal,
        montoPagado,
        saldoPendiente,
        estado,
        cuentaContableId: data.financiero_cuentaPorPagarId,
        asientoRegistroId,
        observacion: data.observacion,
        creadoPor: cuentaPorPagarActual?.creadoPor || user.uid,
        creadoEn: cuentaPorPagarActual?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };
      batch.set(cuentaPorPagarRef, omitUndefinedDeep(cuentaPorPagarData), { merge: true });

      if (shouldApplyStock) {
        const stateByInsumo = new Map<string, { stockActual: number; precioPromedio: number; insumoActual: Insumo }>();

        for (const item of data.mercaderias) {
          const insumoComprado = item.insumo as Insumo;
          const insumoRef = doc(firestore, "insumos", insumoComprado.id);
          const cantidadCompra = Number(item.cantidad) || 0;
          const precioCompra = Number(item.valorUnitario) || 0;
          if (cantidadCompra <= 0 || precioCompra <= 0) continue;

          let state = stateByInsumo.get(insumoComprado.id);
          if (!state) {
            const insumoDoc = await getDoc(insumoRef);
            if (!insumoDoc.exists()) {
              throw new Error(`No se encontro el insumo ${insumoComprado.id}.`);
            }
            const insumoActual = insumoDoc.data() as Insumo;
            state = {
              stockActual: Number(insumoActual.stockActual) || 0,
              precioPromedio: Number(insumoActual.precioPromedioCalculado || insumoActual.costoUnitario) || 0,
              insumoActual,
            };
            stateByInsumo.set(insumoComprado.id, state);
          }

          const stockAnterior = state.stockActual;
          const nuevoStock = stockAnterior + cantidadCompra;
          const nuevoPrecioPromedio =
            stockAnterior + cantidadCompra > 0
              ? (stockAnterior * state.precioPromedio + cantidadCompra * precioCompra) / (stockAnterior + cantidadCompra)
              : precioCompra;

          state.stockActual = nuevoStock;
          state.precioPromedio = nuevoPrecioPromedio;

          batch.update(insumoRef, {
            stockActual: nuevoStock,
            precioPromedioCalculado: nuevoPrecioPromedio,
            costoUnitario: precioCompra,
            ultimaCompra: data.fechaEmision.toISOString(),
          });

          const loteCodigo = item.lote?.trim();
          const controlaLotes = Boolean(state.insumoActual.controlaLotes);
          if (controlaLotes && loteCodigo) {
            const loteRef = doc(collection(firestore, "lotesInsumos"));
            const loteData: Omit<LoteInsumo, "id"> = {
              insumoId: insumoComprado.id,
              codigoLote: loteCodigo,
              costoUnitario: precioCompra,
              fechaIngreso: data.fechaEmision.toISOString(),
              fechaVencimiento: item.sinVencimiento ? null : (item.fechaVencimiento ? item.fechaVencimiento.toISOString() : null),
              cantidadInicial: cantidadCompra,
              cantidadDisponible: cantidadCompra,
              estado: "activo",
              origen: "compra",
              origenId: compraRef.id,
              creadoPor: user.uid,
              creadoEn: new Date().toISOString(),
            };
            batch.set(loteRef, omitUndefinedDeep(loteData));
          }

          const movimientoRef = doc(collection(firestore, "MovimientosStock"));
          const movimientoData: Omit<MovimientoStock, "id"> = {
            fecha: data.fechaEmision,
            tipo: "entrada",
            origen: "compra",
            compraId: compraRef.id,
            zafraId: data.zafraId,
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
          batch.set(movimientoRef, omitUndefinedDeep(movimientoData));
        }
      }

      await batch.commit();
      toast({
        title: compra ? "Compra actualizada" : "Compra registrada",
        description: compra
          ? "Se actualizaron solo datos administrativos; no se recalculo stock ni asientos."
          : "Se guardo correctamente la compra.",
      });
      onCancel();
    } catch (e: any) {
      console.error("Error al guardar la compra y actualizar stock:", e);
      toast({ variant: "destructive", title: "Error al guardar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-1">
        {isEditingExisting && (
          <div className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Edicion administrativa: no se modifican movimientos de stock ni asientos contables.
          </div>
        )}
        {isViewMode && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Vista de detalle en solo lectura.
          </div>
        )}
        <Tabs defaultValue="datos" className="w-full">
          <TabsList>
            <TabsTrigger value="datos">Datos Iniciales</TabsTrigger>
            <TabsTrigger value="mercaderias">Mercaderias</TabsTrigger>
            <TabsTrigger value="flete">Flete</TabsTrigger>
            <TabsTrigger value="financiero">Financiero</TabsTrigger>
            <TabsTrigger value="comprobante">Comprobante</TabsTrigger>
          </TabsList>
          
          <TabsContent value="datos" className="space-y-4 sm:space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <FormField name="entidadId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Proveedor</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="fechaEmision" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Fecha Emision</FormLabel><FormControl><Input type="date" lang="es-PY" disabled={disableTransactional} value={dateToInputValue(field.value)} onChange={(e) => field.onChange(inputValueToDate(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                <FormField name="zafraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Plan de Financiacion / Zafra</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableZafraSelection}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl><SelectContent>{zafras?.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField name="moneda" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PYG">PYG</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormItem><FormLabel>Condicion</FormLabel><div className="rounded-md border px-3 py-2 text-sm">Credito (flujo contable)</div></FormItem>
                <FormField name="formaPago" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Forma de Pago</FormLabel><FormControl><Input {...field} disabled={disableReadonlyOrSaving} /></FormControl><FormMessage /></FormItem> )} />
                <FormField name="totalizadora" control={form.control} render={({ field }) => (<FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-4 h-full"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={disableTransactional} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Totalizadora</FormLabel><FormMessage /></div></FormItem>)} />
            </div>
            <FormField name="observacion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} disabled={disableReadonlyOrSaving} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="mercaderias" className="space-y-4 pt-4">
            <fieldset disabled={disableTransactional}>
              <div className="overflow-x-auto -mx-1 px-1">
              <Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-[350px]">Mercaderia</TableHead>
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
                                            onSelect={(insumo) => {
                                              if (disableTransactional) return;
                                              form.setValue(`mercaderias.${index}.insumo`, insumo);
                                            }}
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
                                  <Input type="date" lang="es-PY" value={formField.value ? format(formField.value, 'yyyy-MM-dd') : ''} onChange={(e) => formField.onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined)} />
                                )} />
                              </TableCell>
                              <TableCell className="text-right font-mono p-1 align-middle">${formatCurrency(valorTotal)}</TableCell>
                              <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                      )})}
                  </TableBody>
                  <TableFooter>
                      <TableRow className="text-base"><TableCell colSpan={5} className="text-right font-bold">Total Mercaderias</TableCell><TableCell className="text-right font-bold font-mono">${formatCurrency(totalMercaderias)}</TableCell><TableCell></TableCell></TableRow>
                  </TableFooter>
              </Table>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ insumo: undefined, cantidad: 0, valorUnitario: 0, lote: '', sinVencimiento: false })}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Item</Button>
            </fieldset>
          </TabsContent>

          <TabsContent value="flete" className="space-y-4 sm:space-y-6 pt-4">
              <FormField name="flete_transportadoraId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Transportadora</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione transportadora" /></SelectTrigger></FormControl><SelectContent>{proveedores?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="flete_datos" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Datos del Flete</FormLabel><FormControl><Textarea {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="flete_valor" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Valor del Flete</FormLabel><FormControl><Input type="number" {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="financiero" className="space-y-4 sm:space-y-6 pt-4">
              <FormField name="financiero_cuentaInventarioId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta de Inventario/Gasto (Debe)</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una cuenta" /></SelectTrigger></FormControl><SelectContent>{planDeCuentas?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="financiero_cuentaPorPagarId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta por Pagar (Haber)</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una cuenta" /></SelectTrigger></FormControl><SelectContent>{planDeCuentas?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField name="financiero_cuentaId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta sugerida para pago futuro (opcional)</FormLabel><FormControl><Input placeholder="Referencia interna" {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="financiero_vencimiento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Vencimiento</FormLabel><FormControl><Input type="date" lang="es-PY" disabled={disableTransactional} value={dateToInputValue(field.value)} onChange={(e) => field.onChange(inputValueToDate(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
              <div className="font-bold text-lg">Valor a Pagar: ${formatCurrency(totalFactura)}</div>
          </TabsContent>
          
          <TabsContent value="comprobante" className="space-y-4 sm:space-y-6 pt-4">
              <FormField name="comprobante_documento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Numero de Documento Legal</FormLabel><FormControl><Input {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="comprobante_timbre" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Timbre</FormLabel><FormControl><Input {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 pt-6 border-t sm:flex-row sm:justify-between sm:items-center">
          <div className="text-xl font-bold">Total Factura: <span className="font-mono">${formatCurrency(totalFactura)}</span></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>{isViewMode ? "Cerrar" : "Cancelar"}</Button>
            {!isViewMode && (
              <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : compra ? "Guardar Cambios" : "Guardar Compra"}</Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}



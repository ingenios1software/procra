
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
import { useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from '@/components/common';
import { SelectorPlanDeCuentas } from '@/components/contabilidad/SelectorPlanDeCuentas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from '@/lib/contabilidad/cuentas-base';
import { calcularEstadoCuenta } from "@/lib/cuentas";
import { resolveZafraContext, withZafraContext } from "@/lib/contabilidad/asientos";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const COMPROBANTE_TIPO_OPERACION_DEFAULT = "8";
const COMPROBANTE_TIPO_DOCUMENTO_DEFAULT = "1";

const COMPROBANTE_TIPO_OPERACION_OPTIONS = [
  { value: "8", label: "8 - Compras del periodo y credito fiscal por operaciones gravadas." },
];

const COMPROBANTE_TIPO_DOCUMENTO_OPTIONS = [
  { value: "1", label: "1 - Factura" },
];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function formatSerieDocumento(value: string): string {
  const digits = digitsOnly(value).slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function normalizeDocumentoNumero(value: string): string {
  return digitsOnly(value).slice(0, 7);
}

function normalizeTimbrado(value: string): string {
  return digitsOnly(value).slice(0, 8);
}

function buildDocumentoLegal(serie: string, numero: string): string {
  const normalizedSerie = formatSerieDocumento(serie);
  const normalizedNumeroBase = normalizeDocumentoNumero(numero);
  const normalizedNumero = normalizedNumeroBase ? normalizedNumeroBase.padStart(7, "0") : "";

  if (!normalizedSerie && !normalizedNumero) return "";
  if (!normalizedSerie) return normalizedNumero;
  if (!normalizedNumero) return normalizedSerie;
  return `${normalizedSerie}-${normalizedNumero}`;
}

function parseDocumentoLegal(documento?: string | null): { serie: string; numero: string } {
  const trimmed = String(documento ?? "").trim();
  if (!trimmed) return { serie: "", numero: "" };

  const directMatch = trimmed.match(/^(\d{3})[- ]?(\d{3})[- ]?(\d{1,7})$/);
  if (directMatch) {
    return {
      serie: `${directMatch[1]}-${directMatch[2]}`,
      numero: directMatch[3].padStart(7, "0"),
    };
  }

  const parts = trimmed.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      serie: formatSerieDocumento(`${parts[0]}${parts[1]}`),
      numero: normalizeDocumentoNumero(parts.slice(2).join("")).padStart(7, "0"),
    };
  }

  const normalizedNumero = normalizeDocumentoNumero(trimmed);
  return { serie: "", numero: normalizedNumero ? normalizedNumero.padStart(7, "0") : "" };
}

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
  comprobante_tipoOperacion: z.string().default(COMPROBANTE_TIPO_OPERACION_DEFAULT),
  comprobante_tipoDocumento: z.string().default(COMPROBANTE_TIPO_DOCUMENTO_DEFAULT),
  comprobante_serie: z.string().regex(/^\d{3}-\d{3}$/, "Ingrese una serie valida (ej: 001-001)."),
  comprobante_numero: z.string().regex(/^\d{7}$/, "Ingrese un numero valido de 7 digitos."),
  comprobante_timbre: z.string().nonempty("El timbre es obligatorio."),
  comprobante_numeroCuotas: z.coerce.number().int().min(1, "Debe indicar al menos una cuota.").default(1),
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
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const parsedDocumento = parseDocumentoLegal(compra?.comprobante?.documento);
  const [isSaving, setIsSaving] = useState(false);

  const isViewMode = mode === 'view';
  const isEditingExisting = mode === 'edit' && Boolean(compra);
  const lockTransactionalFields = Boolean(compra);
  const disableReadonlyOrSaving = isViewMode || isSaving;
  const disableTransactional = disableReadonlyOrSaving || lockTransactionalFields;
  const disableZafraSelection = disableReadonlyOrSaving;

  const { data: proveedores } = useCollection<Proveedor>(useMemoFirebase(() => tenant.collection('proveedores'), [tenant]));
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(useMemoFirebase(() => tenant.query('planDeCuentas', orderBy('codigo')), [tenant]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => tenant.query('zafras', orderBy('nombre')), [tenant]));
  
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
      
      comprobante_tipoOperacion: compra.comprobante.tipoOperacion || COMPROBANTE_TIPO_OPERACION_DEFAULT,
      comprobante_tipoDocumento: compra.comprobante.tipoDocumento || COMPROBANTE_TIPO_DOCUMENTO_DEFAULT,
      comprobante_serie: compra.comprobante.serie || parsedDocumento.serie,
      comprobante_numero: compra.comprobante.numero || parsedDocumento.numero,
      comprobante_timbre: compra.comprobante.timbre,
      comprobante_numeroCuotas: compra.comprobante.numeroCuotas || 1,
    } : {
      fechaEmision: new Date(),
      zafraId: '',
      moneda: 'USD',
      condicionCompra: 'Cr\u00E9dito',
      totalizadora: false,
      mercaderias: [],
      financiero_cuentaInventarioId: '',
      financiero_cuentaPorPagarId: '',
      comprobante_tipoOperacion: COMPROBANTE_TIPO_OPERACION_DEFAULT,
      comprobante_tipoDocumento: COMPROBANTE_TIPO_DOCUMENTO_DEFAULT,
      comprobante_serie: '',
      comprobante_numero: '',
      comprobante_timbre: '',
      comprobante_numeroCuotas: 1,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "mercaderias",
  });
  const [autoFocusFieldId, setAutoFocusFieldId] = useState<string | null>(null);
  const [pendingAppendFocus, setPendingAppendFocus] = useState(false);

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

  useEffect(() => {
    if (!pendingAppendFocus || fields.length === 0) return;

    const lastFieldId = fields[fields.length - 1]?.id;
    if (!lastFieldId) return;

    setAutoFocusFieldId(lastFieldId);
    setPendingAppendFocus(false);
  }, [fields, pendingAppendFocus]);

  const handleAppendMercaderia = () => {
    append({ insumo: undefined, cantidad: 0, valorUnitario: 0, lote: '', sinVencimiento: false });
    setPendingAppendFocus(true);
  };

  const clearAutoFocusField = (fieldId: string) => {
    setAutoFocusFieldId((current) => (current === fieldId ? null : current));
  };

  const handleSubmit = async (data: CompraFormValues) => {
    if (isViewMode || isSaving) return;
    if (!firestore || !user || !tenant.isReady) {
      toast({ variant: "destructive", title: "Error de autenticacion." });
      return;
    }

    setIsSaving(true);
    try {
      const documentoLegal = buildDocumentoLegal(data.comprobante_serie, data.comprobante_numero);
      const zafraContext = resolveZafraContext(
        zafras,
        data.zafraId,
        compra?.zafraNombre || compra?.planFinanciacion || null
      );
      const batch = writeBatch(firestore);
      const comprasCol = tenant.collection("comprasNormal");
      if (!comprasCol) return;
      const compraRef = compra ? tenant.doc("comprasNormal", compra.id) : doc(comprasCol);
      if (!compraRef) return;
      const cuentaPorPagarRef = tenant.doc("cuentasPorPagar", compraRef.id);
      const asientosCol = tenant.collection("asientosDiario");
      const lotesCol = tenant.collection("lotesInsumos");
      const movimientosCol = tenant.collection("MovimientosStock");
      if (!cuentaPorPagarRef || !asientosCol || !lotesCol || !movimientosCol) return;
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
        const asientoCompraRef = doc(asientosCol);
        const asientoCompra: Omit<AsientoDiario, "id"> = withZafraContext({
          fecha: data.fechaEmision.toISOString(),
          descripcion: `Compra credito doc ${documentoLegal}`,
          movimientos: [
            { cuentaId: data.financiero_cuentaInventarioId, tipo: "debe", monto: totalFactura },
            { cuentaId: data.financiero_cuentaPorPagarId, tipo: "haber", monto: totalFactura },
          ],
        }, zafraContext);
        batch.set(asientoCompraRef, asientoCompra);
        asientoRegistroId = asientoCompraRef.id;
      } else if (asientoRegistroId) {
        batch.set(
          tenant.doc("asientosDiario", asientoRegistroId)!,
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
        comprobante: {
          documento: documentoLegal,
          timbre: data.comprobante_timbre,
          tipoOperacion: data.comprobante_tipoOperacion,
          tipoDocumento: data.comprobante_tipoDocumento,
          serie: data.comprobante_serie,
          numero: data.comprobante_numero,
          numeroCuotas: data.comprobante_numeroCuotas,
        }
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
        compraDocumento: documentoLegal,
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
          const insumoRef = tenant.doc("insumos", insumoComprado.id);
          if (!insumoRef) {
            throw new Error(`No se pudo resolver el insumo ${insumoComprado.id}.`);
          }
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
            const loteRef = doc(lotesCol);
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

          const movimientoRef = doc(movimientosCol);
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
                <FormField
                  name="entidadId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <FormControl>
                        <SelectorUniversal<Proveedor>
                          label="Proveedor"
                          collectionName="proveedores"
                          displayField="nombre"
                          codeField="numeroItem"
                          value={proveedores?.find((proveedor) => proveedor.id === field.value)}
                          onSelect={(proveedor) => field.onChange(proveedor?.id ?? "")}
                          searchFields={['nombre', 'numeroItem', 'ruc']}
                          disabled={disableTransactional}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField name="fechaEmision" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Fecha Emision</FormLabel><FormControl><Input type="date" lang="es-PY" disabled={disableTransactional} value={dateToInputValue(field.value)} onChange={(e) => field.onChange(inputValueToDate(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                <FormField
                  name="zafraId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan de Financiacion / Zafra</FormLabel>
                      <FormControl>
                        <SelectorUniversal<Zafra>
                          label="Plan de Financiacion / Zafra"
                          collectionName="zafras"
                          displayField="nombre"
                          codeField="numeroItem"
                          value={zafras?.find((z) => z.id === field.value)}
                          onSelect={(zafra) => field.onChange(zafra?.id ?? "")}
                          searchFields={['nombre', 'numeroItem']}
                          disabled={disableZafraSelection}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <Table resizable>
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
                                            searchFields={['nombre', 'numeroItem']}
                                            autoFocus={autoFocusFieldId === field.id}
                                            onAutoFocusApplied={() => clearAutoFocusField(field.id)} />
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
              <Button type="button" variant="outline" size="sm" onClick={handleAppendMercaderia}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Item</Button>
            </fieldset>
          </TabsContent>

          <TabsContent value="flete" className="space-y-4 sm:space-y-6 pt-4">
              <FormField
                name="flete_transportadoraId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transportadora</FormLabel>
                    <FormControl>
                      <SelectorUniversal<Proveedor>
                        label="Transportadora"
                        collectionName="proveedores"
                        displayField="nombre"
                        codeField="numeroItem"
                        value={proveedores?.find((proveedor) => proveedor.id === field.value)}
                        onSelect={(proveedor) => field.onChange(proveedor?.id ?? "")}
                        searchFields={['nombre', 'numeroItem', 'ruc']}
                        disabled={disableTransactional}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField name="flete_datos" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Datos del Flete</FormLabel><FormControl><Textarea {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="flete_valor" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Valor del Flete</FormLabel><FormControl><Input type="number" {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
          </TabsContent>

          <TabsContent value="financiero" className="space-y-4 sm:space-y-6 pt-4">
              <FormField
                name="financiero_cuentaInventarioId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta de Inventario/Gasto (Debe)</FormLabel>
                    <FormControl>
                      <SelectorPlanDeCuentas
                        label="Cuenta de Inventario/Gasto"
                        value={field.value || null}
                        onChange={(value) => field.onChange(value ?? "")}
                        disabled={disableTransactional}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="financiero_cuentaPorPagarId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta por Pagar (Haber)</FormLabel>
                    <FormControl>
                      <SelectorPlanDeCuentas
                        label="Cuenta por Pagar"
                        value={field.value || null}
                        onChange={(value) => field.onChange(value ?? "")}
                        disabled={disableTransactional}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField name="financiero_cuentaId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Cuenta sugerida para pago futuro (opcional)</FormLabel><FormControl><Input placeholder="Referencia interna" {...field} disabled={disableTransactional} /></FormControl><FormMessage /></FormItem> )} />
              <FormField name="financiero_vencimiento" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Vencimiento</FormLabel><FormControl><Input type="date" lang="es-PY" disabled={disableTransactional} value={dateToInputValue(field.value)} onChange={(e) => field.onChange(inputValueToDate(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
              <div className="font-bold text-lg">Valor a Pagar: ${formatCurrency(totalFactura)}</div>
          </TabsContent>
          
          <TabsContent value="comprobante" className="space-y-4 sm:space-y-6 pt-4">
              <div className="rounded-lg border bg-muted/20 p-4 sm:p-5">
                <div className="mb-5 inline-flex rounded-md border bg-background px-4 py-2 text-sm font-semibold shadow-sm">
                  Documento
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    name="comprobante_tipoOperacion"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Tipo Operacion</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo de operacion" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMPROBANTE_TIPO_OPERACION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="comprobante_tipoDocumento"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Tipo Documento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo de documento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMPROBANTE_TIPO_DOCUMENTO_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="comprobante_serie"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Documento</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="001-001"
                            inputMode="numeric"
                            maxLength={7}
                            disabled={disableTransactional}
                            onChange={(e) => field.onChange(formatSerieDocumento(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="comprobante_numero"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="opacity-0">Numero</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="0020256"
                            inputMode="numeric"
                            maxLength={7}
                            disabled={disableTransactional}
                            onChange={(e) => field.onChange(normalizeDocumentoNumero(e.target.value))}
                            onBlur={(e) => {
                              const normalizedValue = normalizeDocumentoNumero(e.target.value);
                              field.onChange(normalizedValue ? normalizedValue.padStart(7, "0") : "");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="comprobante_timbre"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timbrado</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="12345688"
                            inputMode="numeric"
                            maxLength={8}
                            disabled={disableTransactional}
                            onChange={(e) => field.onChange(normalizeTimbrado(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="comprobante_numeroCuotas"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numero de Cuotas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            disabled={disableTransactional}
                            {...field}
                            value={field.value ?? 1}
                            onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
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



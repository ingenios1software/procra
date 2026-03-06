"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import type {
  Venta,
  Cliente,
  Insumo,
  MovimientoStock,
  Deposito,
  AsientoDiario,
  CuentaCajaBanco,
  Zafra,
  Cultivo,
  PlanDeCuenta,
  CuentaPorCobrar,
  StockGrano,
} from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, doc, writeBatch, query, orderBy, getDoc, getDocs, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { SelectorUniversal } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import { calcularEstadoCuenta, isFormaPagoCredito } from "@/lib/cuentas";
import { resolveZafraContext, withZafraContext } from "@/lib/contabilidad/asientos";
import { isCategoriaGrano, toNumber, toPositiveNumber } from "@/lib/stock/granos";

const itemSchema = z.object({
  producto: z.any().refine((val) => val && val.id, { message: "Debe seleccionar un producto." }),
  descripcion: z.string().optional(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo."),
  descuentoPorc: z.coerce.number().min(0).optional().default(0),
});

const formSchema = z
  .object({
    numeroDocumento: z.string().nonempty("El numero de documento es obligatorio."),
    clienteId: z.string().nonempty("Debe seleccionar un cliente."),
    zafraId: z.string().nonempty("Debe seleccionar una zafra."),
    cultivoId: z.string().optional(),
    fecha: z.date({ required_error: "La fecha es obligatoria." }),
    moneda: z.enum(["USD", "PYG"]),
    formaPago: z.enum(["Contado", "Transferencia", "Crédito"]),
    vencimiento: z.date().optional(),
    vendedorId: z.string().optional(),
    depositoOrigenId: z.string().nonempty("Debe seleccionar un deposito de origen."),
    totalizadora: z.boolean().optional().default(false),
    observacion: z.string().optional(),
    items: z.array(itemSchema).min(1, "Debe agregar al menos un producto."),
    financiero_cuentaId: z.string().optional(),
  })
  .refine((data) => {
    if (data.formaPago === "Crédito" && !data.vencimiento) return false;
    if (["Contado", "Transferencia"].includes(data.formaPago) && !data.financiero_cuentaId) return false;
    return true;
  }, {
    message: "El vencimiento es obligatorio para credito y la cuenta de cobro para contado/transferencia.",
    path: ["vencimiento"],
  });

type VentaFormValues = z.infer<typeof formSchema>;

type StockShortage = {
  productoId: string;
  nombre: string;
  solicitado: number;
  disponible: number;
  faltante: number;
  unidad?: string;
};

interface VentaFormProps {
  venta?: Venta | null;
  onCancel: () => void;
  clientes: Cliente[];
  depositos: Deposito[];
  cuentasCajaBanco: CuentaCajaBanco[];
  zafras: Zafra[];
  cultivos: Cultivo[];
}

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

export function VentaForm({ venta, onCancel, clientes, depositos, cuentasCajaBanco, zafras, cultivos }: VentaFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const isEditingExisting = Boolean(venta);
  const disableTransactional = isEditingExisting;
  const [isStockConfirmOpen, setIsStockConfirmOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<VentaFormValues | null>(null);
  const [stockShortages, setStockShortages] = useState<StockShortage[]>([]);

  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "planDeCuentas"), orderBy("codigo")) : null), [firestore])
  );

  const form = useForm<VentaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: venta
      ? {
          ...venta,
          totalizadora: Boolean(venta.totalizadora),
          financiero_cuentaId: venta.financiero?.cuentaCobroId,
          fecha: new Date(venta.fecha as string),
          vencimiento: venta.vencimiento ? new Date(venta.vencimiento as string) : undefined,
          cultivoId: venta.cultivoId || "",
        }
      : {
          fecha: new Date(),
          moneda: "PYG",
          formaPago: "Contado",
          totalizadora: false,
          items: [],
          depositoOrigenId: depositos[0]?.id || "",
          cultivoId: "",
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: "items" });
  const watchedFormaPago = useWatch({ control: form.control, name: "formaPago" });
  const watchedZafraId = useWatch({ control: form.control, name: "zafraId" });

  useEffect(() => {
    if (form.getValues("depositoOrigenId")) return;
    if (depositos.length > 0) {
      form.setValue("depositoOrigenId", depositos[0].id, { shouldValidate: true });
    }
  }, [depositos, form]);

  useEffect(() => {
    if (watchedFormaPago === "Contado") {
      const caja = cuentasCajaBanco.find((c) => c.tipo === "CAJA");
      const fallback = caja?.id || cuentasCajaBanco[0]?.id;
      if (fallback) form.setValue("financiero_cuentaId", fallback, { shouldValidate: true });
      return;
    }
    if (watchedFormaPago === "Transferencia") {
      const banco = cuentasCajaBanco.find((c) => c.tipo === "BANCO");
      const fallback = banco?.id || cuentasCajaBanco[0]?.id;
      if (fallback) form.setValue("financiero_cuentaId", fallback, { shouldValidate: true });
      return;
    }
    form.setValue("financiero_cuentaId", undefined, { shouldValidate: true });
  }, [watchedFormaPago, cuentasCajaBanco, form]);

  useEffect(() => {
    if (!watchedZafraId) return;
    const zafra = zafras.find((item) => item.id === watchedZafraId);
    const cultivoDesdeZafra = zafra?.cultivoId;
    if (!cultivoDesdeZafra) return;
    const cultivoActual = form.getValues("cultivoId");
    if (cultivoActual === cultivoDesdeZafra) return;
    form.setValue("cultivoId", cultivoDesdeZafra, { shouldValidate: true });
  }, [watchedZafraId, zafras, form]);

  const handleSelectProducto = (index: number, producto: Insumo) => {
    if (disableTransactional) return;
    form.setValue(`items.${index}.producto`, producto, { shouldValidate: true });
    form.setValue(`items.${index}.descripcion`, producto.descripcion, { shouldValidate: true });
    form.setValue(`items.${index}.precioUnitario`, producto.precioVenta || 0, { shouldValidate: true });
    form.trigger(`items.${index}`);
  };

  const { totalGeneral, subtotalIva10, subtotalIva5, exenta, iva10, iva5 } = useMemo(() => {
    let subtotal10 = 0;
    let subtotal5 = 0;
    let subtotalExenta = 0;

    (watchedItems || []).forEach((item) => {
      const producto = item.producto as Insumo | undefined;
      if (!producto) return;
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precioUnitario) || 0;
      const descuento = Number(item.descuentoPorc) || 0;
      const subtotal = cantidad * precio * (1 - descuento / 100);

      if (producto.iva === "10") subtotal10 += subtotal;
      if (producto.iva === "5") subtotal5 += subtotal;
      if (producto.iva === "0") subtotalExenta += subtotal;
    });

    const ivaCalculado10 = subtotal10 - subtotal10 / 1.1;
    const ivaCalculado5 = subtotal5 - subtotal5 / 1.05;
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

  const getCuentaIdPorCodigo = (codigo: string): string | undefined => {
    return findPlanCuentaByCodigo(planDeCuentas || [], codigo)?.id;
  };

  const cultivoById = useMemo(() => {
    return new Map((cultivos || []).map((cultivo) => [cultivo.id, cultivo]));
  }, [cultivos]);

  const getStockShortages = useCallback((items: VentaFormValues["items"]): StockShortage[] => {
    const acumuladoPorProducto = new Map<
      string,
      { solicitado: number; disponible: number; nombre: string; unidad?: string }
    >();

    for (const item of items || []) {
      const producto = item?.producto as Insumo | undefined;
      if (!producto?.id) continue;
      const solicitado = Number(item.cantidad) || 0;
      if (solicitado <= 0) continue;

      const previo = acumuladoPorProducto.get(producto.id);
      if (previo) {
        previo.solicitado += solicitado;
      } else {
        acumuladoPorProducto.set(producto.id, {
          solicitado,
          disponible: Number(producto.stockActual) || 0,
          nombre: producto.descripcion || producto.nombre || producto.id,
          unidad: producto.unidad,
        });
      }
    }

    return Array.from(acumuladoPorProducto.entries())
      .map(([productoId, value]) => ({
        productoId,
        nombre: value.nombre,
        solicitado: value.solicitado,
        disponible: value.disponible,
        faltante: Math.max(0, value.solicitado - value.disponible),
        unidad: value.unidad,
      }))
      .filter((item) => item.faltante > 0);
  }, []);

  const submitVenta = async (data: VentaFormValues, forceTotalizadora = false) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error de autenticacion." });
      return;
    }
    if (!isEditingExisting && (!planDeCuentas || planDeCuentas.length === 0)) {
      toast({
        variant: "destructive",
        title: "Falta plan de cuentas",
        description: "Configure el plan de cuentas antes de registrar ventas.",
      });
      return;
    }

    if (!isEditingExisting && !forceTotalizadora) {
      const shortages = getStockShortages(data.items);
      if (shortages.length > 0) {
        setStockShortages(shortages);
        setPendingSubmitData(data);
        setIsStockConfirmOpen(true);
        return;
      }
    }

    const shouldCreateWorkflowEntries = !venta;
    const shouldApplyStock = shouldCreateWorkflowEntries && !forceTotalizadora;
    const batch = writeBatch(firestore);
    const ventaRef = venta ? doc(firestore, "ventas", venta.id) : doc(collection(firestore, "ventas"));
    const cuentaPorCobrarRef = doc(firestore, "cuentasPorCobrar", ventaRef.id);

    let cuentaPorCobrarActual: CuentaPorCobrar | null = null;
    if (isFormaPagoCredito(data.formaPago)) {
      const cuentaPorCobrarSnap = await getDoc(cuentaPorCobrarRef);
      if (cuentaPorCobrarSnap.exists()) {
        cuentaPorCobrarActual = {
          ...(cuentaPorCobrarSnap.data() as CuentaPorCobrar),
          id: cuentaPorCobrarSnap.id,
        };
      }
    }

    const itemsFinal = data.items.map((item) => {
      const subtotal = item.cantidad * item.precioUnitario * (1 - (item.descuentoPorc || 0) / 100);
      return {
        productoId: item.producto.id,
        descripcion: item.producto.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuentoPorc: item.descuentoPorc || 0,
        subtotal,
      };
    });

    const baseImponible = (subtotalIva10 - iva10) + (subtotalIva5 - iva5) + exenta;
    const totalIva = iva10 + iva5;
    let costoTotalCMV = 0;
    const cultivoSeleccionado = data.cultivoId ? cultivoById.get(data.cultivoId) : undefined;
    const zafraContext = resolveZafraContext(zafras, data.zafraId);

    let asientoVentaId: string | undefined = venta?.financiero?.asientoVentaId;
    let asientoCmvId: string | undefined = venta?.financiero?.asientoCmvId;

    if (shouldCreateWorkflowEntries) {
      if (shouldApplyStock) {
        for (const item of data.items) {
          const producto = item.producto as Insumo;
          const stockActual = toNumber(producto.stockActual);
          const stockDespues = stockActual - item.cantidad;

          const insumoRef = doc(firestore, "insumos", producto.id);
          batch.update(insumoRef, { stockActual: stockDespues });

          const movimientoRef = doc(collection(firestore, "MovimientosStock"));
          const movimiento: Omit<MovimientoStock, "id"> = {
            fecha: data.fecha.toISOString(),
            tipo: "salida",
            origen: "venta",
            documentoOrigen: data.numeroDocumento,
            ventaId: ventaRef.id,
            depositoId: data.depositoOrigenId,
            zafraId: data.zafraId || null,
            cultivo: cultivoSeleccionado?.nombre || null,
            insumoId: producto.id,
            insumoNombre: producto.descripcion || producto.nombre,
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
          batch.set(movimientoRef, movimiento);
          costoTotalCMV += item.cantidad * toPositiveNumber(producto.precioPromedioCalculado || 0);

          const debeAjustarStockGrano =
            isCategoriaGrano(producto.categoria) &&
            Boolean(data.zafraId);

          if (debeAjustarStockGrano) {
            const stockGranosQuery = query(
              collection(firestore, "stockGranos"),
              where("insumoId", "==", producto.id)
            );
            const stockGranosSnap = await getDocs(stockGranosQuery);
            const stocksCandidatos = stockGranosSnap.docs
              .map((docSnap) => {
                const data = docSnap.data() as Omit<StockGrano, "id">;
                return { id: docSnap.id, ...data };
              })
              .filter(
                (stock) =>
                  stock.zafraId === data.zafraId &&
                  (!data.cultivoId || !stock.cultivoId || stock.cultivoId === data.cultivoId)
              )
              .sort((a, b) => toNumber(b.stockActual) - toNumber(a.stockActual));

            let restante = toPositiveNumber(item.cantidad);
            const disponibleTotal = stocksCandidatos.reduce(
              (acc, stock) => acc + Math.max(0, toNumber(stock.stockActual)),
              0
            );

            if (disponibleTotal < restante) {
              toast({
                variant: "destructive",
                title: "Advertencia de stock por zafra",
                description: `La venta supera el stock registrado de ${producto.nombre} para la zafra seleccionada.`,
              });
            }

            for (const stock of stocksCandidatos) {
              if (restante <= 0) break;
              const disponible = Math.max(0, toNumber(stock.stockActual));
              if (disponible <= 0) continue;

              const cantidadADescontar = Math.min(disponible, restante);
              const nuevoStock = disponible - cantidadADescontar;
              const precioPromedioContexto = toPositiveNumber(
                stock.precioPromedio || producto.precioPromedioCalculado || 0
              );

              const stockGranoRef = doc(firestore, "stockGranos", stock.id);
              batch.set(
                stockGranoRef,
                {
                  stockActual: nuevoStock,
                  valorTotal: nuevoStock * precioPromedioContexto,
                  actualizadoEn: new Date().toISOString(),
                  actualizadoPor: user.uid,
                },
                { merge: true }
              );

              restante -= cantidadADescontar;
            }
          }
        }
      }

      let cuentaDebeId: string | undefined;
      if (isFormaPagoCredito(data.formaPago)) {
        cuentaDebeId = getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.CLIENTES);
      } else {
        const cuentaCobro = cuentasCajaBanco.find((c) => c.id === data.financiero_cuentaId);
        if (cuentaCobro?.cuentaContableId) {
          cuentaDebeId = cuentaCobro.cuentaContableId;
        } else if (cuentaCobro?.tipo === "CAJA") {
          cuentaDebeId = getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.CAJA);
        } else if (cuentaCobro?.tipo === "BANCO") {
          cuentaDebeId = getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.BANCO);
        }
      }

      const cuentaVentasId = getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.VENTAS);
      const cuentaIvaDebitoId = totalIva > 0 ? getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.IVA_DEBITO) : undefined;
      const cuentaCmvId = costoTotalCMV > 0 ? getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.CMV) : undefined;
      const cuentaInventarioId = costoTotalCMV > 0 ? getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.INVENTARIO) : undefined;

      const cuentasFaltantes: string[] = [];
      if (!cuentaDebeId) cuentasFaltantes.push("Cuenta de cobro / Clientes");
      if (!cuentaVentasId) cuentasFaltantes.push(`Cuenta ${CODIGOS_CUENTAS_BASE.VENTAS}`);
      if (totalIva > 0 && !cuentaIvaDebitoId) cuentasFaltantes.push(`Cuenta ${CODIGOS_CUENTAS_BASE.IVA_DEBITO}`);
      if (costoTotalCMV > 0 && !cuentaCmvId) cuentasFaltantes.push(`Cuenta ${CODIGOS_CUENTAS_BASE.CMV}`);
      if (costoTotalCMV > 0 && !cuentaInventarioId) cuentasFaltantes.push(`Cuenta ${CODIGOS_CUENTAS_BASE.INVENTARIO}`);

      if (cuentasFaltantes.length > 0) {
        toast({
          variant: "destructive",
          title: "No se puede registrar la venta",
          description: `Faltan cuentas contables: ${cuentasFaltantes.join(", ")}.`,
        });
        return;
      }

      const asientoVentaRef = doc(collection(firestore, "asientosDiario"));
      const movimientosVenta: AsientoDiario["movimientos"] = [
        { cuentaId: cuentaDebeId!, tipo: "debe", monto: totalGeneral },
        { cuentaId: cuentaVentasId!, tipo: "haber", monto: baseImponible },
      ];
      if (totalIva > 0 && cuentaIvaDebitoId) {
        movimientosVenta.push({ cuentaId: cuentaIvaDebitoId, tipo: "haber", monto: totalIva });
      }

      const asientoVenta: Omit<AsientoDiario, "id"> = withZafraContext({
        fecha: data.fecha.toISOString(),
        descripcion: `Venta s/ doc ${data.numeroDocumento}`,
        movimientos: movimientosVenta,
      }, zafraContext);
      batch.set(asientoVentaRef, asientoVenta);
      asientoVentaId = asientoVentaRef.id;

      if (costoTotalCMV > 0 && cuentaCmvId && cuentaInventarioId) {
        const asientoCMVRef = doc(collection(firestore, "asientosDiario"));
        const asientoCMV: Omit<AsientoDiario, "id"> = withZafraContext({
          fecha: data.fecha.toISOString(),
          descripcion: `CMV por venta ${data.numeroDocumento}`,
          movimientos: [
            { cuentaId: cuentaCmvId, tipo: "debe", monto: costoTotalCMV },
            { cuentaId: cuentaInventarioId, tipo: "haber", monto: costoTotalCMV },
          ],
        }, zafraContext);
        batch.set(asientoCMVRef, asientoCMV);
        asientoCmvId = asientoCMVRef.id;
      }
    } else {
      if (asientoVentaId) {
        batch.set(doc(firestore, "asientosDiario", asientoVentaId), withZafraContext({}, zafraContext), { merge: true });
      }
      if (asientoCmvId) {
        batch.set(doc(firestore, "asientosDiario", asientoCmvId), withZafraContext({}, zafraContext), { merge: true });
      }
    }

    const ventaData: Omit<Venta, "id"> = {
      numeroDocumento: data.numeroDocumento,
      clienteId: data.clienteId,
      zafraId: data.zafraId,
      cultivoId: data.cultivoId || undefined,
      fecha: data.fecha.toISOString(),
      moneda: data.moneda,
      formaPago: data.formaPago,
      totalizadora: shouldCreateWorkflowEntries ? forceTotalizadora : Boolean(venta?.totalizadora),
      vencimiento: data.vencimiento ? data.vencimiento.toISOString() : undefined,
      vendedorId: data.vendedorId,
      depositoOrigenId: data.depositoOrigenId,
      observacion: data.observacion,
      items: itemsFinal,
      total: totalGeneral,
      financiero: {
        cuentaCobroId: data.financiero_cuentaId,
        total: totalGeneral,
        vencimiento: data.vencimiento ? data.vencimiento.toISOString() : undefined,
        asientoVentaId,
        asientoCmvId,
      },
    };

    const ventaDataSanitized = omitUndefinedDeep(ventaData);
    if (venta) {
      batch.update(ventaRef, ventaDataSanitized as any);
    } else {
      batch.set(ventaRef, ventaDataSanitized);
    }

    if (isFormaPagoCredito(data.formaPago)) {
      const montoOriginal = Number(cuentaPorCobrarActual?.montoOriginal ?? totalGeneral) || 0;
      const montoCobrado = Number(cuentaPorCobrarActual?.montoCobrado ?? 0) || 0;
      const saldoPendiente = Number(cuentaPorCobrarActual?.saldoPendiente ?? totalGeneral) || 0;
      const cuentaContableId =
        cuentaPorCobrarActual?.cuentaContableId || getCuentaIdPorCodigo(CODIGOS_CUENTAS_BASE.CLIENTES);
      const fechaVencimiento = data.vencimiento ? data.vencimiento.toISOString() : undefined;
      const estado = calcularEstadoCuenta({
        montoOriginal,
        saldoPendiente,
        fechaVencimiento,
      });

      const cuentaPorCobrarData: Omit<CuentaPorCobrar, "id"> = {
        ventaId: ventaRef.id,
        ventaDocumento: data.numeroDocumento,
        clienteId: data.clienteId,
        zafraId: data.zafraId,
        zafraNombre: zafraContext.zafraNombre || null,
        fechaEmision: data.fecha.toISOString(),
        fechaVencimiento,
        moneda: data.moneda,
        montoOriginal,
        montoCobrado,
        saldoPendiente,
        estado,
        cuentaContableId,
        asientoVentaId,
        observacion: data.observacion,
        creadoPor: cuentaPorCobrarActual?.creadoPor || user.uid,
        creadoEn: cuentaPorCobrarActual?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      batch.set(cuentaPorCobrarRef, omitUndefinedDeep(cuentaPorCobrarData), { merge: true });
    }

    try {
      await batch.commit();
      toast({
        title: venta ? "Venta actualizada con exito" : "Venta registrada con exito",
        description: venta
          ? "Se actualizaron solo datos administrativos; no se recalculo stock ni asientos."
          : forceTotalizadora
            ? "Se registro como venta sujeta a totalizadora; no se desconto stock ni se genero movimiento de salida."
            : "Se registraron documento, stock y asientos contables.",
      });
      onCancel();
    } catch (e: any) {
      console.error("Error al guardar la venta:", e);
      toast({ variant: "destructive", title: "Error al guardar", description: e.message });
    }
  };

  const handleFormSubmit: SubmitHandler<VentaFormValues> = async (data) => {
    await submitVenta(data);
  };

  const handleConfirmTotalizadora = async () => {
    if (!pendingSubmitData) return;
    const data = pendingSubmitData;
    setPendingSubmitData(null);
    setIsStockConfirmOpen(false);
    setStockShortages([]);
    await submitVenta(data, true);
  };

  const handleCancelTotalizadora = () => {
    setIsStockConfirmOpen(false);
    setPendingSubmitData(null);
    setStockShortages([]);
  };

  const formatQty = (value: number) =>
    (Number(value) || 0).toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 p-1">
        {isEditingExisting && (
          <div className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Edicion administrativa: no se modifican movimientos de stock ni asientos contables.
          </div>
        )}
        {Boolean(venta?.totalizadora) && (
          <div className="rounded-md border border-blue-300/60 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Esta venta fue registrada sujeta a totalizadora. El stock no se desconto al momento de guardar.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-6">
          <FormField
            name="numeroDocumento"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>N Documento</FormLabel>
                <FormControl><Input {...field} disabled={disableTransactional} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="fecha"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(e) => field.onChange(inputValueToDate(e.target.value))}
                    disabled={disableTransactional}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="clienteId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un cliente" /></SelectTrigger></FormControl>
                  <SelectContent>{(clientes || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="zafraId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zafra</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una zafra" /></SelectTrigger></FormControl>
                  <SelectContent>{(zafras || []).map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="cultivoId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cultivo</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                  value={field.value || "__none__"}
                  disabled={disableTransactional}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {(cultivos || []).map((cultivo) => (
                      <SelectItem key={cultivo.id} value={cultivo.id}>
                        {cultivo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="depositoOrigenId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deposito origen</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione deposito" /></SelectTrigger></FormControl>
                  <SelectContent>{(depositos || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Tabs defaultValue="detalle" className="w-full">
          <TabsList>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="financiero">Financiero</TabsTrigger>
            <TabsTrigger value="observaciones">Observaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="space-y-4 pt-4">
            <div className="overflow-x-auto -mx-1 px-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[350px]">Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Desc. (%)</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const item = watchedItems?.[index];
                    const cantidad = Number(item?.cantidad) || 0;
                    const precio = Number(item?.precioUnitario) || 0;
                    const descuento = Number(item?.descuentoPorc) || 0;
                    const subtotal = cantidad * precio * (1 - descuento / 100);

                    return (
                      <TableRow key={field.id} className="align-top">
                        <TableCell className="min-w-[300px] p-1">
                          <FormField
                            control={form.control}
                            name={`items.${index}.producto`}
                            render={({ field: formField }) => (
                              <SelectorUniversal<Insumo>
                                label="Producto"
                                collectionName="insumos"
                                displayField="descripcion"
                                codeField="codigo"
                                value={formField.value}
                                onSelect={(insumo) => insumo && handleSelectProducto(index, insumo)}
                                searchFields={["descripcion", "codigo"]}
                                disabled={disableTransactional}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <FormField control={form.control} name={`items.${index}.cantidad`} render={({ field: formField }) => <Input type="number" {...formField} disabled={disableTransactional} />} />
                        </TableCell>
                        <TableCell className="p-1">
                          <FormField control={form.control} name={`items.${index}.precioUnitario`} render={({ field: formField }) => <Input type="number" {...formField} disabled={disableTransactional} />} />
                        </TableCell>
                        <TableCell className="p-1">
                          <FormField control={form.control} name={`items.${index}.descuentoPorc`} render={({ field: formField }) => <Input type="number" {...formField} disabled={disableTransactional} />} />
                        </TableCell>
                        <TableCell className="p-1 text-right font-mono align-middle">${formatCurrency(subtotal)}</TableCell>
                        <TableCell className="p-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={disableTransactional}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({} as any)} disabled={disableTransactional}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Producto
            </Button>
          </TabsContent>

          <TabsContent value="financiero" className="space-y-4 sm:space-y-6 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                name="formaPago"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Contado">Contado</SelectItem>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Crédito">Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedFormaPago !== "Crédito" && (
                <FormField
                  name="financiero_cuentaId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta de Cobro</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={disableTransactional}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una cuenta" /></SelectTrigger></FormControl>
                        <SelectContent>{cuentasCajaBanco.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchedFormaPago === "Crédito" && (
                <FormField
                  name="vencimiento"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          lang="es-PY"
                          value={dateToInputValue(field.value)}
                          onChange={(e) => field.onChange(inputValueToDate(e.target.value))}
                          disabled={disableTransactional}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="observaciones" className="pt-4">
            <FormField
              name="observacion"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gravado 10%:</span><span>{formatCurrency(subtotalIva10 - iva10)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gravado 5%:</span><span>{formatCurrency(subtotalIva5 - iva5)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Exenta:</span><span>{formatCurrency(exenta)}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA 10%:</span><span>{formatCurrency(iva10)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA 5%:</span><span>{formatCurrency(iva5)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold"><span className="text-foreground">Total General:</span><span>${formatCurrency(totalGeneral)}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">{venta ? "Guardar Cambios" : "Guardar Venta"}</Button>
        </div>

        <AlertDialog
          open={isStockConfirmOpen}
          onOpenChange={setIsStockConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Stock insuficiente</AlertDialogTitle>
              <AlertDialogDescription>
                No hay stock suficiente para completar esta venta. Puede cancelar o continuar como venta sujeta a totalizadora.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-48 overflow-y-auto rounded-md border p-3 text-sm">
              {stockShortages.map((item) => (
                <div key={item.productoId} className="mb-2 last:mb-0">
                  <div className="font-medium">{item.nombre}</div>
                  <div className="text-muted-foreground">
                    Disponible: {formatQty(item.disponible)} {item.unidad || ""} | Solicitado: {formatQty(item.solicitado)} {item.unidad || ""} | Faltante: {formatQty(item.faltante)} {item.unidad || ""}
                  </div>
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelTotalizadora}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmTotalizadora}>
                Continuar sujeto a totalizadora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </Form>
  );
}

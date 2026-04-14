"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type {
  CompraNormal,
  Proveedor,
  AsientoDiario,
  PlanDeCuenta,
  CuentaCajaBanco,
  CuentaPorPagar,
  PagoCuentaPorPagar,
} from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CompraNormalForm } from "@/components/comercial/compras/compra-normal-form";
import { MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, getDocs, orderBy, where, writeBatch } from 'firebase/firestore';
import { calcularEstadoCuenta, calcularSaldoDesdeMovimiento } from "@/lib/cuentas";
import { withZafraContext } from "@/lib/contabilidad/asientos";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { useAuth } from "@/hooks/use-auth";
import { calcularPrecioPromedioDesdeCompras } from "@/lib/stock/precio-promedio-lotes";

const STOCK_TOLERANCE = 0.0001;

function toDateSafe(value?: Date | string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeLote(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function buildLoteKey(insumoId: string, lote?: string | null): string {
  return `${insumoId}::${normalizeLote(lote)}`;
}

function resolveAnulacionComprasWindow(empresa: any): { enabled: boolean; message?: string } {
  const config = empresa?.operacion?.anulacionCompras;
  if (!config?.habilitado) {
    return {
      enabled: false,
      message: "La ventana operativa para anular compras no esta habilitada en Configuracion Comercial.",
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const desde = toDateSafe(config.desde);
  if (desde) {
    desde.setHours(0, 0, 0, 0);
    if (hoy < desde) {
      return {
        enabled: false,
        message: `La ventana de anulacion abre el ${format(desde, "dd/MM/yyyy")}.`,
      };
    }
  }

  const hasta = toDateSafe(config.hasta);
  if (hasta) {
    hasta.setHours(23, 59, 59, 999);
    if (hoy > hasta) {
      return {
        enabled: false,
        message: `La ventana de anulacion vencio el ${format(hasta, "dd/MM/yyyy")}.`,
      };
    }
  }

  return { enabled: true };
}

function resolveLatestCompraInfo(insumoId: string, compras: CompraNormal[]): { precio: number | null; fecha: string | null } {
  let precio: number | null = null;
  let fecha: string | null = null;
  let latestTs = -1;

  for (const compra of compras) {
    if (compra.estado === "anulado") continue;
    const fechaCompra = toDateSafe(compra.fechaEmision)?.getTime() || -1;
    for (const item of compra.mercaderias || []) {
      if (item.insumoId !== insumoId) continue;
      const valorUnitario = Number(item.valorUnitario) || 0;
      if (valorUnitario <= 0) continue;
      if (fechaCompra >= latestTs) {
        latestTs = fechaCompra;
        precio = valorUnitario;
        fecha = typeof compra.fechaEmision === "string" ? compra.fechaEmision : new Date(compra.fechaEmision).toISOString();
      }
    }
  }

  return { precio, fecha };
}


export default function ComprasPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user, permisos, empresa } = useAuth();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<CompraNormal | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [compraParaAprobar, setCompraParaAprobar] = useState<CompraNormal | null>(null);
  const [cuentaPagoAprobacionId, setCuentaPagoAprobacionId] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();

  const comprasQuery = useMemoFirebase(() =>
    tenant.query('comprasNormal', orderBy('fechaEmision', 'desc'))
  , [tenant]);
  const { data: compras, isLoading: isLoadingCompras } = useCollection<CompraNormal>(comprasQuery);

  const proveedoresQuery = useMemoFirebase(() =>
    tenant.query('proveedores')
  , [tenant]);
  const { data: proveedores, isLoading: isLoadingProveedores } = useCollection<Proveedor>(proveedoresQuery);
  const planDeCuentasQuery = useMemoFirebase(() =>
    tenant.query('planDeCuentas', orderBy('codigo'))
  , [tenant]);
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);
  const cuentasCajaBancoQuery = useMemoFirebase(() =>
    tenant.query('cuentasCajaBanco', where('activo', '==', true))
  , [tenant]);
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(cuentasCajaBancoQuery);

  const getProveedorNombre = (id: string) => {
    if (!proveedores) return 'N/A';
    return proveedores.find(p => p.id === id)?.nombre || 'N/A';
  }


  const cuentasPago = useMemo(() => {
    const cuentas = planDeCuentas || [];
    const cajasBancos = cuentasCajaBanco || [];
    const byId = new Map(cuentas.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const options: Array<{ id: string; label: string }> = [];

    // Preferir cuentas contables vinculadas a cuentas de caja/banco.
    for (const cb of cajasBancos) {
      if (!cb.cuentaContableId) continue;
      const cuenta = byId.get(cb.cuentaContableId);
      if (!cuenta) continue;
      if (seen.has(cuenta.id)) continue;
      seen.add(cuenta.id);
      options.push({
        id: cuenta.id,
        label: `${cb.tipo} ${cb.nombre} - ${cuenta.codigo} - ${cuenta.nombre}`,
      });
    }

    // Fallback: cuentas de activo/deudora para no dejar el selector vacio.
    const normalize = (v?: string) => (v || "").toLowerCase().trim();
    if (options.length === 0) {
      for (const c of cuentas) {
        const tipo = normalize((c as any).tipo);
        const naturaleza = normalize((c as any).naturaleza);
        const nombre = normalize(c.nombre);
        const esActiva = tipo === "activo";
        const pareceCajaBanco = nombre.includes("caja") || nombre.includes("banco") || nombre.includes("efectivo");
        if (!(esActiva || (naturaleza === "deudora" && pareceCajaBanco))) continue;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        options.push({ id: c.id, label: `${c.codigo} - ${c.nombre}` });
      }
    }

    return options;
  }, [planDeCuentas, cuentasCajaBanco]);

  const handleOpenApprove = (compra: CompraNormal) => {
    setCompraParaAprobar(compra);
    setCuentaPagoAprobacionId("");
  };

  const handleApproveCompra = async () => {
    if (!firestore || !compraParaAprobar || !user || !tenant.isReady) return;
    if (compraParaAprobar.estado !== 'abierto') {
      toast({ variant: 'destructive', title: 'Estado invalido', description: 'Solo se pueden aprobar compras abiertas.' });
      return;
    }
    if (!compraParaAprobar.financiero?.cuentaPorPagarId) {
      toast({ variant: 'destructive', title: 'Falta cuenta por pagar', description: 'Edite la compra y seleccione cuenta por pagar.' });
      return;
    }

    setIsApproving(true);
    try {
      const batch = writeBatch(firestore);
      const compraRef = tenant.doc('comprasNormal', compraParaAprobar.id);
      const cuentaPorPagarRef = tenant.doc('cuentasPorPagar', compraParaAprobar.id);
      const asientosCol = tenant.collection('asientosDiario');
      const pagosCol = tenant.collection('pagosCxp');
      if (!compraRef || !cuentaPorPagarRef || !asientosCol || !pagosCol) return;
      const cuentaPorPagarSnap = await getDoc(cuentaPorPagarRef);
      const cuentaPorPagarActual = cuentaPorPagarSnap.exists()
        ? ({ ...(cuentaPorPagarSnap.data() as CuentaPorPagar), id: cuentaPorPagarSnap.id } as CuentaPorPagar)
        : null;

      const montoOriginal = Number(cuentaPorPagarActual?.montoOriginal ?? compraParaAprobar.totalFactura) || 0;
      const montoPagadoActual = Number(cuentaPorPagarActual?.montoPagado ?? 0) || 0;
      const saldoPendienteActual =
        Number(cuentaPorPagarActual?.saldoPendiente ?? (montoOriginal - montoPagadoActual)) || 0;

      const pagoAplicado = Boolean(cuentaPagoAprobacionId);
      if (pagoAplicado && !(planDeCuentas || []).some((c) => c.id === cuentaPagoAprobacionId)) {
        toast({
          variant: 'destructive',
          title: 'Cuenta de pago invalida',
          description: 'Seleccione nuevamente la cuenta contable de pago.',
        });
        setIsApproving(false);
        return;
      }
      if (pagoAplicado && saldoPendienteActual <= 0.005) {
        toast({
          variant: 'destructive',
          title: 'Saldo cancelado',
          description: 'La cuenta por pagar ya no tiene saldo pendiente.',
        });
        setIsApproving(false);
        return;
      }

      const fechaOperacion = new Date().toISOString();
      let asientoPagoId: string | undefined;
      let montoPago = 0;

      if (pagoAplicado) {
        montoPago = saldoPendienteActual > 0 ? saldoPendienteActual : compraParaAprobar.totalFactura;
        const asientoPagoRef = doc(asientosCol);
        const asientoPago: Omit<AsientoDiario, 'id'> = withZafraContext({
          fecha: fechaOperacion,
          descripcion: `Pago compra ${compraParaAprobar.comprobante.documento}`,
          movimientos: [
            { cuentaId: compraParaAprobar.financiero.cuentaPorPagarId, tipo: 'debe', monto: montoPago },
            { cuentaId: cuentaPagoAprobacionId, tipo: 'haber', monto: montoPago },
          ],
        }, {
          zafraId: compraParaAprobar.zafraId,
          zafraNombre: compraParaAprobar.zafraNombre || compraParaAprobar.planFinanciacion || null,
        });
        batch.set(asientoPagoRef, asientoPago);
        asientoPagoId = asientoPagoRef.id;

        const pagoRef = doc(pagosCol);
        const pagoData: Omit<PagoCuentaPorPagar, 'id'> = {
          cuentaPorPagarId: compraParaAprobar.id,
          compraId: compraParaAprobar.id,
          proveedorId: compraParaAprobar.entidadId,
          zafraId: compraParaAprobar.zafraId,
          zafraNombre: compraParaAprobar.zafraNombre || compraParaAprobar.planFinanciacion || null,
          fecha: fechaOperacion,
          moneda: compraParaAprobar.moneda,
          monto: montoPago,
          cuentaContableId: cuentaPagoAprobacionId,
          asientoId: asientoPagoId,
          pagadoPor: user.id,
          creadoEn: fechaOperacion,
        };
        batch.set(pagoRef, pagoData);
      }

      const resultadoSaldo = pagoAplicado
        ? calcularSaldoDesdeMovimiento({
            montoOriginal,
            montoAplicadoActual: montoPagadoActual,
            montoMovimiento: montoPago,
          })
        : {
            montoAplicado: montoPagadoActual,
            saldoPendiente: Math.max(0, saldoPendienteActual),
          };
      const nuevoMontoPagado = resultadoSaldo.montoAplicado;
      const nuevoSaldoPendiente = resultadoSaldo.saldoPendiente;
      const fechaVencimiento = cuentaPorPagarActual?.fechaVencimiento || compraParaAprobar.financiero?.vencimiento;
      const estadoCuenta = calcularEstadoCuenta({
        montoOriginal,
        saldoPendiente: nuevoSaldoPendiente,
        fechaVencimiento,
      });

      batch.set(
        cuentaPorPagarRef,
        {
          compraId: compraParaAprobar.id,
          compraDocumento: compraParaAprobar.comprobante.documento,
          proveedorId: compraParaAprobar.entidadId,
          zafraId: compraParaAprobar.zafraId,
          zafraNombre: compraParaAprobar.zafraNombre || compraParaAprobar.planFinanciacion || null,
          fechaEmision: compraParaAprobar.fechaEmision,
          moneda: compraParaAprobar.moneda,
          montoOriginal,
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente,
          estado: estadoCuenta,
          cuentaContableId: compraParaAprobar.financiero.cuentaPorPagarId,
          asientoRegistroId: compraParaAprobar.financiero.asientoRegistroId,
          actualizadoEn: fechaOperacion,
          creadoPor: cuentaPorPagarActual?.creadoPor || user.id,
          creadoEn: cuentaPorPagarActual?.creadoEn || fechaOperacion,
          ...(fechaVencimiento ? { fechaVencimiento } : {}),
        } satisfies Omit<CuentaPorPagar, 'id'>,
        { merge: true }
      );

      const saldoCancelado = nuevoSaldoPendiente <= 0.005;

      batch.update(compraRef, {
        estado: 'cerrado',
        'financiero.pagoAplicado': pagoAplicado ? saldoCancelado : false,
        'financiero.cuentaPagoId': pagoAplicado ? cuentaPagoAprobacionId : null,
        'financiero.asientoPagoId': asientoPagoId || null,
        'financiero.fechaPago': pagoAplicado ? fechaOperacion : null,
      });

      await batch.commit();
      toast({ title: pagoAplicado ? 'Compra aprobada y pagada' : 'Compra aprobada sin pago' });
      setCompraParaAprobar(null);
      setCuentaPagoAprobacionId('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'No se pudo aprobar', description: error?.message || 'Error inesperado' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleAnularCompra = async (compra: CompraNormal) => {
    if (!firestore || !user || !tenant.isReady) return;
    if (compra.estado === 'anulado') {
      toast({ variant: 'destructive', title: 'Compra ya anulada', description: 'La compra seleccionada ya se encuentra anulada.' });
      return;
    }
    if (!permisos.administracion) {
      toast({
        variant: 'destructive',
        title: 'Permiso insuficiente',
        description: 'Solo administracion puede anular compras operativas.',
      });
      return;
    }
    const ventanaAnulacion = resolveAnulacionComprasWindow(empresa);
    if (!ventanaAnulacion.enabled) {
      toast({
        variant: 'destructive',
        title: 'Ventana operativa cerrada',
        description: ventanaAnulacion.message,
      });
      return;
    }
    if (!window.confirm(`Desea anular la compra ${compra.comprobante.documento}? Se revertiran cuenta por pagar, asiento y stock si corresponde.`)) return;

    try {
      const batch = writeBatch(firestore);
      const compraRef = tenant.doc('comprasNormal', compra.id);
      const cuentaPorPagarRef = tenant.doc('cuentasPorPagar', compra.id);
      const asientosCol = tenant.collection('asientosDiario');
      const movimientosCol = tenant.collection('MovimientosStock');
      if (!compraRef || !cuentaPorPagarRef || !asientosCol || !movimientosCol) return;
      const fechaAnulacion = new Date().toISOString();
      const motivoAnulacion =
        compra.estado === 'cerrado'
          ? 'Anulacion operativa de compra aprobada'
          : 'Anulacion operativa de compra';

      const cuentaPorPagarSnap = await getDoc(cuentaPorPagarRef);
      const cuentaPorPagarActual = cuentaPorPagarSnap.exists()
        ? ({ ...(cuentaPorPagarSnap.data() as CuentaPorPagar), id: cuentaPorPagarSnap.id } as CuentaPorPagar)
        : null;
      const pagosQuery = tenant.query('pagosCxp', where('compraId', '==', compra.id));
      const pagosSnap = pagosQuery ? await getDocs(pagosQuery) : null;
      const montoPagado = Number(cuentaPorPagarActual?.montoPagado ?? 0) || 0;
      if (montoPagado > 0.005 || Boolean(compra.financiero?.pagoAplicado) || Boolean(pagosSnap && !pagosSnap.empty)) {
        toast({
          variant: 'destructive',
          title: 'Compra con pagos aplicados',
          description: 'Primero debe anular el pago o la nota aplicada sobre esta factura de compra.',
        });
        return;
      }

      const cuentaInventarioId = compra.financiero?.cuentaInventarioId;
      const cuentaPorPagarId = compra.financiero?.cuentaPorPagarId || cuentaPorPagarActual?.cuentaContableId;
      if (!cuentaInventarioId || !cuentaPorPagarId) {
        toast({
          variant: 'destructive',
          title: 'Datos contables incompletos',
          description: 'La compra no tiene definidas las cuentas necesarias para generar la reversa contable.',
        });
        return;
      }

      const lotesCompraByKey = new Map<string, Array<{ id: string; ref: any; data: any }>>();
      const requiredByLote = new Map<string, number>();
      const affectedInsumos = new Map<
        string,
        {
          ref: any;
          insumoActual: any;
          cantidadAnular: number;
          stockActual: number;
          nuevoStock: number;
        }
      >();

      if (!compra.totalizadora) {
        const lotesCompraQuery = tenant.query('lotesInsumos', where('origenId', '==', compra.id));
        const lotesCompraSnap = lotesCompraQuery ? await getDocs(lotesCompraQuery) : null;
        lotesCompraSnap?.forEach((loteDoc) => {
          const loteData = loteDoc.data();
          const key = buildLoteKey(loteData.insumoId, loteData.codigoLote);
          const current = lotesCompraByKey.get(key) || [];
          current.push({ id: loteDoc.id, ref: loteDoc.ref, data: loteData });
          lotesCompraByKey.set(key, current);
        });

        for (const item of compra.mercaderias || []) {
          const cantidad = Number(item.cantidad) || 0;
          if (cantidad <= 0) continue;

          const insumoRef = tenant.doc('insumos', item.insumoId);
          if (!insumoRef) {
            throw new Error(`No se pudo resolver el insumo ${item.insumoId}.`);
          }

          let state = affectedInsumos.get(item.insumoId);
          if (!state) {
            const insumoSnap = await getDoc(insumoRef);
            if (!insumoSnap.exists()) {
              throw new Error(`No se encontro el insumo ${item.insumoId}.`);
            }
            const insumoActual = insumoSnap.data();
            const stockActual = Number(insumoActual.stockActual) || 0;
            state = {
              ref: insumoRef,
              insumoActual,
              cantidadAnular: 0,
              stockActual,
              nuevoStock: stockActual,
            };
            affectedInsumos.set(item.insumoId, state);
          }

          state.cantidadAnular += cantidad;
          state.nuevoStock = state.stockActual - state.cantidadAnular;
          if (state.nuevoStock < -STOCK_TOLERANCE) {
            toast({
              variant: 'destructive',
              title: 'Stock insuficiente para anular',
              description: `El insumo ${state.insumoActual.nombre || item.insumoId} quedaria con stock negativo.`,
            });
            return;
          }

          if (state.insumoActual.controlaLotes && normalizeLote(item.lote)) {
            const loteKey = buildLoteKey(item.insumoId, item.lote);
            requiredByLote.set(loteKey, (requiredByLote.get(loteKey) || 0) + cantidad);
          }
        }

        for (const [loteKey, requiredQty] of requiredByLote.entries()) {
          const lotes = lotesCompraByKey.get(loteKey) || [];
          const availableQty = lotes.reduce((acc, lote) => acc + (Number(lote.data.cantidadDisponible) || 0), 0);
          if (lotes.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Lote no encontrado',
              description: 'No se encontro el lote original de esta compra. La anulacion debe revisarse manualmente.',
            });
            return;
          }
          if (availableQty + STOCK_TOLERANCE < requiredQty) {
            toast({
              variant: 'destructive',
              title: 'Lote con consumo posterior',
              description: 'La mercaderia de esta compra ya fue consumida parcialmente. Primero regularice stock y luego anule.',
            });
            return;
          }
          if (Math.abs(availableQty - requiredQty) > STOCK_TOLERANCE) {
            toast({
              variant: 'destructive',
              title: 'Lote desalineado',
              description: 'El lote de la compra no coincide con la cantidad original y requiere revision manual.',
            });
            return;
          }
        }
      }

      const asientoAnulacionRef = doc(asientosCol);
      const asientoAnulacion: Omit<AsientoDiario, 'id'> = withZafraContext(
        {
          fecha: fechaAnulacion,
          descripcion: `Anulacion compra ${compra.comprobante.documento}`,
          movimientos: [
            { cuentaId: cuentaPorPagarId, tipo: 'debe', monto: compra.totalFactura },
            { cuentaId: cuentaInventarioId, tipo: 'haber', monto: compra.totalFactura },
          ],
        },
        {
          zafraId: compra.zafraId,
          zafraNombre: compra.zafraNombre || compra.planFinanciacion || null,
        }
      );
      batch.set(asientoAnulacionRef, asientoAnulacion);

      const comprasRecalculadas = (compras || []).map((item) =>
        item.id === compra.id ? { ...item, estado: 'anulado' as const } : item
      );

      for (const state of affectedInsumos.values()) {
        const precioPromedioRecalculado = calcularPrecioPromedioDesdeCompras(state.insumoActual.id, comprasRecalculadas);
        const latestCompraInfo = resolveLatestCompraInfo(state.insumoActual.id, comprasRecalculadas);
        const fallbackPromedio =
          state.nuevoStock > STOCK_TOLERANCE
            ? Number(state.insumoActual.precioPromedioCalculado || state.insumoActual.costoUnitario) || 0
            : 0;
        const fallbackCostoUnitario =
          state.nuevoStock > STOCK_TOLERANCE
            ? Number(state.insumoActual.costoUnitario || precioPromedioRecalculado || fallbackPromedio) || 0
            : 0;

        batch.update(state.ref, {
          stockActual: Math.max(0, state.nuevoStock),
          precioPromedioCalculado: precioPromedioRecalculado ?? fallbackPromedio,
          costoUnitario: latestCompraInfo.precio ?? fallbackCostoUnitario,
          ultimaCompra: latestCompraInfo.fecha || null,
        });
      }

      if (!compra.totalizadora) {
        for (const loteDocs of lotesCompraByKey.values()) {
          for (const lote of loteDocs) {
            batch.delete(lote.ref);
          }
        }

        const runningStockByInsumo = new Map<string, number>();
        for (const item of compra.mercaderias || []) {
          const cantidad = Number(item.cantidad) || 0;
          if (cantidad <= 0) continue;
          const state = affectedInsumos.get(item.insumoId);
          if (!state) continue;
          const stockAntes = runningStockByInsumo.get(item.insumoId) ?? state.stockActual;
          const stockDespues = Math.max(0, stockAntes - cantidad);
          runningStockByInsumo.set(item.insumoId, stockDespues);
          const movimientoRef = doc(movimientosCol);
          batch.set(movimientoRef, {
            fecha: fechaAnulacion,
            tipo: 'ajuste',
            origen: 'ajuste manual',
            compraId: compra.id,
            zafraId: compra.zafraId,
            insumoId: item.insumoId,
            insumoNombre: state.insumoActual.nombre,
            unidad: state.insumoActual.unidad,
            categoria: state.insumoActual.categoria,
            cantidad,
            stockAntes,
            stockDespues,
            precioUnitario: Number(item.valorUnitario) || 0,
            costoTotal: cantidad * (Number(item.valorUnitario) || 0),
            lote: item.lote?.trim() || undefined,
            loteVencimiento: item.fechaVencimiento || null,
            creadoPor: user.id,
            creadoEn: new Date(),
          });
        }
      }

      batch.update(compraRef, {
        estado: 'anulado',
        anuladoPor: user.id,
        anuladoEn: fechaAnulacion,
        motivoAnulacion,
        'financiero.pagoAplicado': false,
        'financiero.fechaPago': null,
        'financiero.asientoAnulacionId': asientoAnulacionRef.id,
      });
      batch.set(
        cuentaPorPagarRef,
        {
          estado: 'anulada',
          saldoPendiente: 0,
          actualizadoEn: fechaAnulacion,
          observacion: motivoAnulacion,
        },
        { merge: true }
      );
      await batch.commit();
      toast({ title: 'Compra anulada', description: 'Se registro la reversa contable y, si correspondia, la reversa de stock.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'No se pudo anular', description: error?.message || 'Error inesperado' });
    }
  };

  const openForm = (compra?: CompraNormal, mode: 'create' | 'edit' | 'view' = 'create') => {
    setSelectedCompra(compra || null);
    setFormMode(mode);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedCompra(null);
    setFormMode('create');
  }

  const shareSummary = `Facturas: ${compras?.length || 0}.`;

  return (
    <>
      <PageHeader
        title="Consulta de Facturas de Compra"
        description="Consulte, edite y registre las compras de insumos, productos y servicios."
      >
        <ReportActions reportTitle="Consulta de Facturas de Compra" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Compra
          </Button>
        )}
      </PageHeader>
      <div id="pdf-area" className="print-area">
      <Card>
        <CardHeader>
          <CardTitle>Listado de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table resizable className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Zafra</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Entidad (Proveedor)</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoadingCompras || isLoadingProveedores) && <TableRow><TableCell colSpan={10} className="text-center">Cargando...</TableCell></TableRow>}
              {compras?.map((compra) => (
                <TableRow key={compra.id}>
                  <TableCell>{compra.codigo}</TableCell>
                  <TableCell>{format(new Date(compra.fechaEmision as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{compra.zafraNombre || compra.planFinanciacion || "-"}</TableCell>
                  <TableCell>{compra.comprobante.documento}</TableCell>
                  <TableCell>{getProveedorNombre(compra.entidadId)}</TableCell>
                  <TableCell className="text-right font-mono">${compra.totalFactura.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                   <TableCell>{compra.moneda}</TableCell>
                  <TableCell>{compra.usuario}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-green-600 text-white": compra.estado === 'cerrado',
                        "bg-yellow-500 text-black": compra.estado === 'abierto',
                         "bg-red-600 text-white": compra.estado === 'anulado',
                      })}
                    >
                      {compra.estado}
                    </Badge>
                  </TableCell>
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openForm(compra, 'view')}>Ver Detalle</DropdownMenuItem>
                        {compra.estado === "abierto" && <DropdownMenuItem onClick={() => openForm(compra, 'edit')}>Editar</DropdownMenuItem>}
                        {compra.estado === "abierto" && <DropdownMenuItem onClick={() => handleOpenApprove(compra)}>Aprobar</DropdownMenuItem>}
                        {permisos.administracion && compra.estado !== "anulado" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => handleAnularCompra(compra)}>
                            Anular
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>

      <Dialog modal={false} open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent draggable className="max-w-6xl">
           <DialogHeader>
             <DialogTitle>
               {selectedCompra
                 ? (formMode === 'view' ? `Detalle Compra Nro ${selectedCompra.codigo}` : `Editar Compra Nro ${selectedCompra.codigo}`)
                 : 'Registrar Nueva Compra Normal'}
             </DialogTitle>
             <DialogDescription>
                Complete los detalles de la factura o documento de compra.
             </DialogDescription>
           </DialogHeader>
            <div className="overflow-y-auto max-h-[70dvh] sm:max-h-[78dvh] pr-1">
              <CompraNormalForm compra={selectedCompra} mode={formMode} onCancel={closeForm} />
            </div>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={Boolean(compraParaAprobar)} onOpenChange={(open) => !open && setCompraParaAprobar(null)}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>Aprobar compra</DialogTitle>
            <DialogDescription>
              Puede cerrar la compra solo como crédito, o aplicar pago inmediato desde una cuenta (caja/banco).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Comprobante</p>
              <p className="font-medium">{compraParaAprobar?.comprobante?.documento}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-medium">{compraParaAprobar?.totalFactura?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta de pago contable (opcional)</label>
              <Select value={cuentaPagoAprobacionId} onValueChange={setCuentaPagoAprobacionId}>
                <SelectTrigger><SelectValue placeholder="Aprobar sin pago inmediato" /></SelectTrigger>
                <SelectContent>
                  {cuentasPago.length === 0 && (
                    <SelectItem value="sin-cuentas" disabled>No hay cuentas de pago configuradas</SelectItem>
                  )}
                  {cuentasPago.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompraParaAprobar(null)}>Cancelar</Button>
            <Button onClick={handleApproveCompra} disabled={isApproving}>{isApproving ? 'Aprobando...' : 'Confirmar aprobación'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}



"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { doc, orderBy, writeBatch } from "firebase/firestore";
import { ArrowRightLeft, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { ReciboPagoEmpleado as ReciboPagoEmpleadoCard, type ReciboPagoEmpleadoViewModel } from "@/components/rrhh/recibo-pago-empleado";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { autoconfigurarBaseFinanzasNomina } from "@/lib/contabilidad/autoconfiguracion-finanzas";
import { generarNumeroReciboPagoEmpleado, toDateSafe } from "@/lib/cuentas";
import type {
  AsientoDiario,
  ControlHorario,
  CuentaCajaBanco,
  Empleado,
  Moneda,
  MovimientoTesoreria,
  PagoNominaHoras,
  PlanDeCuenta,
  ReciboPagoEmpleado,
} from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

type LiquidacionRow = {
  empleadoId: string;
  nombre: string;
  horasDev: number;
  montoDev: number;
  horasPag: number;
  montoPag: number;
  horasPend: number;
  montoPend: number;
};

function buildPeriodoLabel(year: number, monthIndex: number): string {
  return `${MONTHS[monthIndex] || monthIndex + 1} ${year}`;
}

function normalizeText(value?: string): string {
  return (value || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatGs(value: number): string {
  return `Gs. ${Math.round(value || 0).toLocaleString("es-PY")}`;
}

function formatHours(value: number): string {
  return (Math.round((value || 0) * 100) / 100).toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDateInputToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getMonedaCodigo(monedaId: string | undefined, monedasById: Map<string, Moneda>): "USD" | "PYG" | null {
  if (!monedaId) return null;
  const moneda = monedasById.get(monedaId);
  const base = `${moneda?.codigo || ""} ${moneda?.descripcion || ""} ${monedaId}`.toUpperCase();
  if (base.includes("USD")) return "USD";
  if (base.includes("PYG") || base.includes("GS") || base.includes("GUARANI")) return "PYG";
  return null;
}

function getRegistroHours(registro: ControlHorario): number {
  const mins = (registro.actividades || []).reduce((sum, a) => {
    if (!timeRegex.test(a.horaInicio) || !timeRegex.test(a.horaFin)) return sum;
    const [h1, m1] = a.horaInicio.split(":").map(Number);
    const [h2, m2] = a.horaFin.split(":").map(Number);
    const diff = h2 * 60 + m2 - (h1 * 60 + m1);
    return sum + (diff > 0 ? diff : 0);
  }, 0);
  return mins / 60;
}

function pagoEsPeriodo(pago: PagoNominaHoras, year: number, monthIndex: number): boolean {
  const mes = Number(pago.periodoMes);
  const anio = Number(pago.periodoAnio);
  if (Number.isFinite(mes) && Number.isFinite(anio) && mes >= 1 && mes <= 12) {
    return anio === year && mes === monthIndex + 1;
  }
  const fecha = toDateSafe(pago.fechaPago);
  return !!fecha && fecha.getFullYear() === year && fecha.getMonth() === monthIndex;
}

function reciboEsPeriodo(recibo: ReciboPagoEmpleado, year: number, monthIndex: number): boolean {
  const mes = Number(recibo.periodoMes);
  const anio = Number(recibo.periodoAnio);
  if (Number.isFinite(mes) && Number.isFinite(anio) && mes >= 1 && mes <= 12) {
    return anio === year && mes === monthIndex + 1;
  }
  const fecha = toDateSafe(recibo.fecha);
  return !!fecha && fecha.getFullYear() === year && fecha.getMonth() === monthIndex;
}

export default function LiquidacionPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const { toast } = useToast();

  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedRow, setSelectedRow] = useState<LiquidacionRow | null>(null);
  const [fechaPago, setFechaPago] = useState(format(new Date(), "yyyy-MM-dd"));
  const [montoPago, setMontoPago] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [gastoId, setGastoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<ReciboPagoEmpleadoViewModel | null>(null);
  const [selectedRecibo, setSelectedRecibo] = useState<ReciboPagoEmpleadoViewModel | null>(null);

  const { data: empleados, isLoading: l1 } = useCollection<Empleado>(useMemoFirebase(() => tenant.collection("empleados"), [tenant]));
  const { data: registros, isLoading: l2 } = useCollection<ControlHorario>(useMemoFirebase(() => tenant.collection("controlHorario"), [tenant]));
  const { data: pagosNomina, isLoading: l3, forceRefetch } = useCollection<PagoNominaHoras>(useMemoFirebase(() => tenant.collection("pagosNominaHoras"), [tenant]));
  const { data: planDeCuentas, isLoading: l4, forceRefetch: refetchPlan } = useCollection<PlanDeCuenta>(useMemoFirebase(() => tenant.collection("planDeCuentas"), [tenant]));
  const { data: cuentasCajaBanco, isLoading: l5, forceRefetch: refetchCajas } = useCollection<CuentaCajaBanco>(useMemoFirebase(() => tenant.collection("cuentasCajaBanco"), [tenant]));
  const { data: monedas, isLoading: l6, forceRefetch: refetchMonedas } = useCollection<Moneda>(useMemoFirebase(() => tenant.collection("monedas"), [tenant]));
  const { data: recibosPago, isLoading: l7, forceRefetch: refetchRecibos } = useCollection<ReciboPagoEmpleado>(
    useMemoFirebase(() => tenant.query("recibosPagoEmpleado", orderBy("fecha", "desc")), [tenant])
  );

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const periodLabel = buildPeriodoLabel(year, month);

  const empleadosById = useMemo(() => new Map((empleados || []).map((e) => [e.id, `${e.apellido}, ${e.nombre}`.replace(/^,\s*/, "").trim() || e.id])), [empleados]);
  const empleadosDataById = useMemo(() => new Map((empleados || []).map((empleado) => [empleado.id, empleado])), [empleados]);
  const planById = useMemo(() => new Map((planDeCuentas || []).map((c) => [c.id, c])), [planDeCuentas]);
  const monedasById = useMemo(() => new Map((monedas || []).map((m) => [m.id, m])), [monedas]);

  const cuentasGasto = useMemo(() => (planDeCuentas || []).filter((c) => c.tipo === "gasto" || c.tipo === "costo"), [planDeCuentas]);
  const gastoSugeridoId = useMemo(() => {
    return cuentasGasto.find((c) => normalizeText(`${c.codigo} ${c.nombre}`).includes("jornal") || normalizeText(`${c.codigo} ${c.nombre}`).includes("sueldo"))?.id || cuentasGasto[0]?.id || "";
  }, [cuentasGasto]);

  const cajasPyg = useMemo(() => {
    return (cuentasCajaBanco || [])
      .filter((caja) => {
        if (caja.activo === false || caja.tipo !== "CAJA" || !caja.cuentaContableId) return false;
        const moneda = getMonedaCodigo(caja.monedaId, monedasById);
        return moneda === "PYG";
      })
      .map((caja) => {
        const cuenta = planById.get(caja.cuentaContableId as string);
        return {
          id: caja.id,
          cuentaContableId: caja.cuentaContableId as string,
          label: `${caja.nombre} - ${cuenta?.codigo || ""} - ${cuenta?.nombre || ""}`.trim(),
        };
      });
  }, [cuentasCajaBanco, monedasById, planById]);

  const cajaById = useMemo(() => new Map(cajasPyg.map((caja) => [caja.id, caja])), [cajasPyg]);
  const cajaLabelById = useMemo(() => {
    return new Map(
      (cuentasCajaBanco || []).map((caja) => {
        const cuenta = caja.cuentaContableId ? planById.get(caja.cuentaContableId) : undefined;
        const label = `${caja.nombre} - ${cuenta?.codigo || ""} - ${cuenta?.nombre || ""}`.trim();
        return [caja.id, label];
      })
    );
  }, [cuentasCajaBanco, planById]);

  const buildReciboView = (recibo: ReciboPagoEmpleado): ReciboPagoEmpleadoViewModel => {
    const empleado = empleadosDataById.get(recibo.empleadoId);
    const monthIndex = Math.max(0, Number(recibo.periodoMes || 1) - 1);
    return {
      id: recibo.id,
      numero: recibo.numero,
      empleadoNombre:
        empleado ? `${empleado.apellido}, ${empleado.nombre}`.replace(/^,\s*/, "").trim() : recibo.empleadoId,
      empleadoDocumento: empleado?.documento,
      empleadoPuesto: empleado?.puesto,
      periodoLabel: buildPeriodoLabel(Number(recibo.periodoAnio) || year, monthIndex),
      fecha: recibo.fecha,
      moneda: recibo.moneda,
      horasLiquidadas: Number(recibo.horasLiquidadas) || 0,
      monto: Number(recibo.monto) || 0,
      estado: recibo.estado,
      cajaLabel: cajaLabelById.get(recibo.cuentaCajaBancoId) || recibo.cuentaCajaBancoId,
      observacion: recibo.observacion,
    };
  };

  const recibosPeriodo = useMemo(() => {
    return (recibosPago || [])
      .filter((recibo) => reciboEsPeriodo(recibo, year, month))
      .map(buildReciboView)
      .sort((a, b) => {
        const fechaB = toDateSafe(b.fecha)?.getTime() || 0;
        const fechaA = toDateSafe(a.fecha)?.getTime() || 0;
        return fechaB - fechaA;
      });
  }, [recibosPago, year, month, empleadosDataById, cajaLabelById]);

  const rows = useMemo<LiquidacionRow[]>(() => {
    const dev = new Map<string, { h: number; m: number }>();
    for (const r of registros || []) {
      const f = toDateSafe(r.fecha);
      if (!f || f.getFullYear() !== year || f.getMonth() !== month) continue;
      const horas = getRegistroHours(r);
      const monto = horas * Math.max(0, Number(r.precioHoraGs) || 0);
      const cur = dev.get(r.empleadoId) || { h: 0, m: 0 };
      cur.h += horas;
      cur.m += monto;
      dev.set(r.empleadoId, cur);
    }

    const pag = new Map<string, { h: number; m: number }>();
    for (const p of pagosNomina || []) {
      if (!pagoEsPeriodo(p, year, month)) continue;
      const cur = pag.get(p.empleadoId) || { h: 0, m: 0 };
      cur.h += Math.max(0, Number(p.horasLiquidadas) || 0);
      cur.m += Math.max(0, Number(p.monto) || 0);
      pag.set(p.empleadoId, cur);
    }

    const ids = new Set<string>();
    for (const id of dev.keys()) ids.add(id);
    for (const id of pag.keys()) ids.add(id);
    return Array.from(ids).map((empleadoId) => {
      const d = dev.get(empleadoId) || { h: 0, m: 0 };
      const p = pag.get(empleadoId) || { h: 0, m: 0 };
      return {
        empleadoId,
        nombre: empleadosById.get(empleadoId) || empleadoId,
        horasDev: d.h,
        montoDev: d.m,
        horasPag: p.h,
        montoPag: p.m,
        horasPend: Math.max(0, d.h - p.h),
        montoPend: Math.max(0, d.m - p.m),
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [empleadosById, month, pagosNomina, registros, year]);

  const resumen = useMemo(() => rows.reduce((acc, r) => {
    acc.dev += r.montoDev;
    acc.pag += r.montoPag;
    acc.pend += r.montoPend;
    return acc;
  }, { dev: 0, pag: 0, pend: 0 }), [rows]);
  const setupIncompleto = cajasPyg.length === 0 || cuentasGasto.length === 0;
  const reciboTargetId = "rrhh-recibo-pago-target";
  const reciboSummary = selectedRecibo
    ? `${selectedRecibo.empleadoNombre} | ${selectedRecibo.periodoLabel} | ${formatGs(selectedRecibo.monto)}`
    : "";

  const handleAutoConfig = async () => {
    if (!firestore) return;
    setIsAutoConfiguring(true);
    try {
      const { createdItems } = await autoconfigurarBaseFinanzasNomina({
        firestore,
        empresaId: tenant.empresaId,
        monedas: monedas || [],
        cuentasCajaBanco: cuentasCajaBanco || [],
        planDeCuentas: planDeCuentas || [],
      });

      if (createdItems.length === 0) {
        toast({
          title: "Sin cambios",
          description: "Ya existe configuracion base para caja/banco, moneda PYG y jornales.",
        });
      } else {
        toast({
          title: "Autoconfiguracion completada",
          description: `Creados: ${createdItems.join(", ")}.`,
        });
      }

      refetchPlan();
      refetchCajas();
      refetchMonedas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo autoconfigurar",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const openPago = (row: LiquidacionRow) => {
    setSelectedRow(row);
    setFechaPago(format(new Date(), "yyyy-MM-dd"));
    setMontoPago(String(Math.round(row.montoPend)));
    setCajaId(cajasPyg[0]?.id || "");
    setGastoId(gastoSugeridoId);
    setReferencia("");
  };

  const closePago = () => {
    setSelectedRow(null);
    setMontoPago("");
    setReferencia("");
  };

  const openRecibo = (recibo: ReciboPagoEmpleadoViewModel) => {
    setSelectedRecibo(recibo);
  };

  const closeRecibo = () => {
    setSelectedRecibo(null);
  };

  const guardarPago = async () => {
    if (!firestore || !user || !selectedRow) return;
    const monto = Number(montoPago);
    if (!Number.isFinite(monto) || monto <= 0 || monto > selectedRow.montoPend + 0.5) {
      toast({ variant: "destructive", title: "Monto invalido", description: "Revise el monto a pagar." });
      return;
    }
    const caja = cajaById.get(cajaId);
    const gasto = planById.get(gastoId);
    if (!caja || !gasto) {
      toast({ variant: "destructive", title: "Faltan cuentas", description: "Seleccione caja y cuenta de gasto." });
      return;
    }
    const fechaIso = parseDateInputToIso(fechaPago);
    if (!fechaIso) {
      toast({ variant: "destructive", title: "Fecha invalida", description: "Revise la fecha." });
      return;
    }

    setIsSaving(true);
    try {
      const pagosCol = tenant.collection("pagosNominaHoras");
      const recibosCol = tenant.collection("recibosPagoEmpleado");
      const asientosCol = tenant.collection("asientosDiario");
      const movimientosCol = tenant.collection("movimientosTesoreria");
      if (!pagosCol || !recibosCol || !asientosCol || !movimientosCol) return;
      const pagoRef = doc(pagosCol);
      const reciboRef = doc(recibosCol);
      const asientoRef = doc(asientosCol);
      const movRef = doc(movimientosCol);
      const fechaAsDate = toDateSafe(fechaIso) || new Date();
      const numeroRecibo = generarNumeroReciboPagoEmpleado(fechaAsDate, pagoRef.id.slice(-4));
      const horas = selectedRow.montoPend > 0 ? (selectedRow.horasPend * monto) / selectedRow.montoPend : 0;
      const horasLiquidadas = Math.round(horas * 100) / 100;
      const descripcion = `Pago jornales por horas - ${selectedRow.nombre} - ${periodLabel}`;
      const batch = writeBatch(firestore);

      batch.set(asientoRef, {
        fecha: fechaIso,
        descripcion,
        movimientos: [
          { cuentaId: gasto.id, tipo: "debe", monto },
          { cuentaId: caja.cuentaContableId, tipo: "haber", monto },
        ],
      } as Omit<AsientoDiario, "id">);

      batch.set(movRef, {
        fecha: fechaIso,
        tipoOperacion: "egreso",
        medio: "efectivo",
        moneda: "PYG",
        monto,
        descripcion,
        cuentaOrigenCajaBancoId: caja.id,
        cuentaOrigenContableId: caja.cuentaContableId,
        cuentaContrapartidaId: gasto.id,
        asientoId: asientoRef.id,
        creadoPor: user.uid,
        creadoEn: fechaIso,
      } as Omit<MovimientoTesoreria, "id">);

      batch.set(pagoRef, {
        empleadoId: selectedRow.empleadoId,
        periodoAnio: year,
        periodoMes: month + 1,
        fechaPago: fechaIso,
        moneda: "PYG",
        horasLiquidadas,
        monto,
        cuentaGastoId: gasto.id,
        cuentaCajaBancoId: caja.id,
        cuentaCajaContableId: caja.cuentaContableId,
        asientoId: asientoRef.id,
        movimientoTesoreriaId: movRef.id,
        reciboId: reciboRef.id,
        pagadoPor: user.uid,
        creadoEn: fechaIso,
        ...(referencia.trim() ? { observacion: referencia.trim() } : {}),
      } as Omit<PagoNominaHoras, "id">);

      batch.set(reciboRef, {
        numero: numeroRecibo,
        pagoNominaId: pagoRef.id,
        empleadoId: selectedRow.empleadoId,
        periodoAnio: year,
        periodoMes: month + 1,
        fecha: fechaIso,
        moneda: "PYG",
        horasLiquidadas,
        monto,
        estado: "emitido",
        cuentaCajaBancoId: caja.id,
        emitidoPor: user.uid,
        creadoEn: fechaIso,
        ...(referencia.trim() ? { observacion: referencia.trim() } : {}),
      } as Omit<ReciboPagoEmpleado, "id">);

      await batch.commit();
      const reciboPreview: ReciboPagoEmpleadoViewModel = {
        id: reciboRef.id,
        numero: numeroRecibo,
        empleadoNombre: selectedRow.nombre,
        empleadoDocumento: empleadosDataById.get(selectedRow.empleadoId)?.documento,
        empleadoPuesto: empleadosDataById.get(selectedRow.empleadoId)?.puesto,
        periodoLabel: periodLabel,
        fecha: fechaIso,
        moneda: "PYG",
        horasLiquidadas,
        monto,
        estado: "emitido",
        cajaLabel: caja.label,
        observacion: referencia.trim() || undefined,
      };
      setUltimoRecibo(reciboPreview);
      setSelectedRecibo(reciboPreview);
      closePago();
      forceRefetch();
      refetchRecibos();
      toast({ title: "Pago registrado", description: `Recibo emitido: ${numeroRecibo}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al registrar pago", description: error?.message || "Error inesperado." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Liquidacion de Jornales por Horas"
        description="Calcula el devengado desde Control Horario y registra pago en caja con asiento y recibo."
      >
        <Button asChild variant="outline">
          <Link href="/finanzas/tesoreria">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Ir a Tesoreria
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Periodo</CardTitle>
            <CardDescription>Primero fondee caja (venta/cobro/retiro), luego pague empleados desde esta pantalla.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <div className="rounded-md border px-3 py-2 text-sm">
              Devengado: {formatGs(resumen.dev)} | Pagado: {formatGs(resumen.pag)} | Pendiente: {formatGs(resumen.pend)}
            </div>
          </CardContent>
        </Card>

        {setupIncompleto && (
          <Alert>
            <AlertTitle>Configuracion pendiente para liquidar jornales</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Complete moneda/caja PYG y cuenta de gasto de jornales.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleAutoConfig} disabled={isAutoConfiguring}>
                  {isAutoConfiguring ? "Autoconfigurando..." : "Autoconfigurar ahora"}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/maestros/cuentas-caja-banco">Ir a Ctas Caja/Banco (Autoconfigurar Base)</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/contabilidad/plan-de-cuentas">Ir a Plan de Cuentas</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {cajasPyg.length === 0 && (
          <Alert variant="destructive">
            <AlertTitle>Sin caja PYG</AlertTitle>
            <AlertDescription>
              Configure una cuenta CAJA en guaranies para pagar jornales.
            </AlertDescription>
          </Alert>
        )}

        {cuentasGasto.length === 0 && (
          <Alert variant="destructive">
            <AlertTitle>Sin cuenta de gasto</AlertTitle>
            <AlertDescription>Agregue en Plan de Cuentas una cuenta de gasto/costo para jornales.</AlertDescription>
          </Alert>
        )}

        {ultimoRecibo && (
          <Alert>
            <AlertTitle>Ultimo recibo emitido</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {ultimoRecibo.numero} · {ultimoRecibo.empleadoNombre} · {formatGs(ultimoRecibo.monto)}
              </span>
              <Button size="sm" variant="outline" onClick={() => openRecibo(ultimoRecibo)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver recibo
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Liquidacion por empleado - {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Horas Dev.</TableHead>
                  <TableHead className="text-right">Devengado</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="h-20 text-center">Cargando...</TableCell></TableRow>}
                {!isLoading && rows.map((row) => (
                  <TableRow key={row.empleadoId}>
                    <TableCell>{row.nombre}</TableCell>
                    <TableCell className="text-right">{formatHours(row.horasDev)} h</TableCell>
                    <TableCell className="text-right">{formatGs(row.montoDev)}</TableCell>
                    <TableCell className="text-right">{formatGs(row.montoPag)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatGs(row.montoPend)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => openPago(row)} disabled={row.montoPend <= 0.005 || cajasPyg.length === 0 || cuentasGasto.length === 0}>
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="h-20 text-center">Sin datos en este periodo.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <CardTitle>Recibos emitidos - {periodLabel}</CardTitle>
            <CardDescription>Reimprima o descargue en PDF los recibos ya emitidos en este periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recibo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center">Cargando recibos...</TableCell>
                  </TableRow>
                )}
                {!isLoading && recibosPeriodo.map((recibo) => {
                  const fechaRecibo = toDateSafe(recibo.fecha);
                  return (
                    <TableRow key={recibo.id}>
                      <TableCell className="font-medium">{recibo.numero}</TableCell>
                      <TableCell>{fechaRecibo ? format(fechaRecibo, "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell>{recibo.empleadoNombre}</TableCell>
                      <TableCell className="text-right">{formatHours(recibo.horasLiquidadas)}</TableCell>
                      <TableCell className="text-right">{formatGs(recibo.monto)}</TableCell>
                      <TableCell>{recibo.cajaLabel}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openRecibo(recibo)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver / Reimprimir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && recibosPeriodo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center">
                      No hay recibos emitidos en este periodo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog modal={false} open={!!selectedRow} onOpenChange={(open) => !open && closePago()}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Genera asiento, salida de caja, pago de nomina y recibo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Empleado: <strong>{selectedRow?.nombre || "-"}</strong></div>
            <div className="text-sm">Pendiente: <strong>{formatGs(selectedRow?.montoPend || 0)}</strong></div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
              <Input type="number" min={0} step="1" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} placeholder="Monto Gs" />
            </div>
            <Select value={cajaId} onValueChange={setCajaId}>
              <SelectTrigger><SelectValue placeholder="Caja origen" /></SelectTrigger>
              <SelectContent>{cajasPyg.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={gastoId} onValueChange={setGastoId}>
              <SelectTrigger><SelectValue placeholder="Cuenta gasto" /></SelectTrigger>
              <SelectContent>{cuentasGasto.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referencia opcional" rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePago}>Cancelar</Button>
            <Button onClick={guardarPago} disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar y emitir recibo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={!!selectedRecibo} onOpenChange={(open) => !open && closeRecibo()}>
        <DialogContent draggable className="max-w-[96vw] overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>{selectedRecibo ? `Recibo ${selectedRecibo.numero}` : "Recibo de pago"}</DialogTitle>
            <DialogDescription>
              Puede reimprimir o descargar en PDF el recibo emitido para este pago.
            </DialogDescription>
            <ReportActions
              reportTitle={selectedRecibo ? `Recibo ${selectedRecibo.numero}` : "Recibo de Pago"}
              reportSummary={reciboSummary}
              imageTargetId={reciboTargetId}
              printTargetId={reciboTargetId}
              documentLabel="Recibo de Pago de Jornales"
              showDefaultFooter={false}
            />
          </DialogHeader>

          {selectedRecibo && (
            <div className="max-h-[calc(92dvh-7rem)] overflow-y-auto overflow-x-hidden px-2 pb-4 sm:px-4 sm:pb-6">
              <ReciboPagoEmpleadoCard recibo={selectedRecibo} />
            </div>
          )}

          {selectedRecibo && (
            <div id={reciboTargetId} className="report-export-only">
              <ReciboPagoEmpleadoCard recibo={selectedRecibo} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

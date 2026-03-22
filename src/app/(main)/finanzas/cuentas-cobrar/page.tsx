"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { doc, orderBy, where, writeBatch } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReciboCobro as ReciboCobroCard, type ReciboCobroViewModel } from "@/components/finanzas/recibo-cobro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import {
  calcularAntiguedadSaldos,
  calcularEstadoCuenta,
  calcularSaldoDesdeMovimiento,
  generarNumeroReciboCobro,
  toDateSafe,
} from "@/lib/cuentas";
import { withZafraContext } from "@/lib/contabilidad/asientos";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import type {
  AsientoDiario,
  Cliente,
  CobroCuentaPorCobrar,
  CuentaCajaBanco,
  CuentaPorCobrar,
  PlanDeCuenta,
  ReciboCobro,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const ESTADO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "abierta", label: "Abierta" },
  { value: "parcial", label: "Parcial" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
  { value: "anulada", label: "Anulada" },
] as const;

type EstadoFiltro = (typeof ESTADO_OPTIONS)[number]["value"];

type CuentaPagoOption = {
  id: string;
  label: string;
  cuentaCajaBancoId?: string;
};

function getEstadoClassName(estado: CuentaPorCobrar["estado"]): string {
  if (estado === "cancelada") return "bg-green-600 text-white";
  if (estado === "vencida") return "bg-red-600 text-white";
  if (estado === "parcial") return "bg-blue-600 text-white";
  if (estado === "anulada") return "bg-gray-600 text-white";
  return "bg-yellow-500 text-black";
}

function parseDateInputToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function CuentasCobrarPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorCobrar | null>(null);
  const [montoCobro, setMontoCobro] = useState("");
  const [fechaCobro, setFechaCobro] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cuentaPagoId, setCuentaPagoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [isSavingCobro, setIsSavingCobro] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<ReciboCobroViewModel | null>(null);
  const [isReciboOpen, setIsReciboOpen] = useState(false);

  const {
    data: cuentasPorCobrar,
    isLoading: isLoadingCxc,
    forceRefetch: refetchCxc,
  } = useCollection<CuentaPorCobrar>(
    useMemoFirebase(
      () => tenant.query("cuentasPorCobrar", orderBy("fechaEmision", "desc")),
      [tenant]
    )
  );
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(
    useMemoFirebase(() => tenant.collection("clientes"), [tenant])
  );
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(
      () => tenant.query("planDeCuentas", orderBy("codigo")),
      [tenant]
    )
  );
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(
    useMemoFirebase(
      () => tenant.query("cuentasCajaBanco", where("activo", "==", true)),
      [tenant]
    )
  );

  const clientesById = useMemo(() => {
    return new Map((clientes || []).map((cliente) => [cliente.id, cliente.nombre]));
  }, [clientes]);

  const cuentasPago = useMemo<CuentaPagoOption[]>(() => {
    const cuentas = planDeCuentas || [];
    const cajasBancos = cuentasCajaBanco || [];
    const byId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
    const used = new Set<string>();
    const options: CuentaPagoOption[] = [];

    for (const cajaBanco of cajasBancos) {
      if (!cajaBanco.cuentaContableId) continue;
      const cuenta = byId.get(cajaBanco.cuentaContableId);
      if (!cuenta) continue;
      if (used.has(cuenta.id)) continue;
      used.add(cuenta.id);
      options.push({
        id: cuenta.id,
        label: `${cajaBanco.tipo} ${cajaBanco.nombre} - ${cuenta.codigo} - ${cuenta.nombre}`,
        cuentaCajaBancoId: cajaBanco.id,
      });
    }

    if (options.length > 0) return options;

    for (const cuenta of cuentas) {
      if (!(cuenta.tipo === "activo" && cuenta.naturaleza === "deudora")) continue;
      if (used.has(cuenta.id)) continue;
      used.add(cuenta.id);
      options.push({ id: cuenta.id, label: `${cuenta.codigo} - ${cuenta.nombre}` });
    }
    return options;
  }, [planDeCuentas, cuentasCajaBanco]);

  const cuentasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (cuentasPorCobrar || []).filter((cuenta) => {
      if (estadoFiltro !== "todos" && cuenta.estado !== estadoFiltro) return false;
      if (!term) return true;
      const cliente = (clientesById.get(cuenta.clienteId) || "").toLowerCase();
      const documento = (cuenta.ventaDocumento || "").toLowerCase();
      return (
        cliente.includes(term) ||
        documento.includes(term) ||
        cuenta.id.toLowerCase().includes(term) ||
        cuenta.ventaId.toLowerCase().includes(term)
      );
    });
  }, [cuentasPorCobrar, estadoFiltro, search, clientesById]);

  const resumen = useMemo(() => {
    const cuentas = cuentasPorCobrar || [];
    const pendiente = cuentas.reduce((sum, cuenta) => sum + (cuenta.saldoPendiente || 0), 0);
    const vencido = cuentas
      .filter((cuenta) => cuenta.estado === "vencida")
      .reduce((sum, cuenta) => sum + (cuenta.saldoPendiente || 0), 0);
    const canceladas = cuentas.filter((cuenta) => cuenta.estado === "cancelada").length;
    return { pendiente, vencido, canceladas };
  }, [cuentasPorCobrar]);

  const antiguedad = useMemo(() => calcularAntiguedadSaldos(cuentasPorCobrar || []), [cuentasPorCobrar]);
  const totalAntiguedad = useMemo(
    () => antiguedad.reduce((acc, bucket) => acc + bucket.monto, 0),
    [antiguedad]
  );

  const shareSummary = `Pendiente: $${formatCurrency(resumen.pendiente)} | Vencido: $${formatCurrency(
    resumen.vencido
  )} | Canceladas: ${resumen.canceladas}.`;
  const reciboTargetId = "finanzas-recibo-cobro-target";
  const reciboSummary = ultimoRecibo
    ? `${ultimoRecibo.clienteNombre} | ${ultimoRecibo.documento} | ${ultimoRecibo.moneda} ${formatCurrency(ultimoRecibo.monto)}`
    : "";

  const openCobroDialog = (cuenta: CuentaPorCobrar) => {
    setCuentaSeleccionada(cuenta);
    setMontoCobro(String(Number(cuenta.saldoPendiente || 0)));
    setFechaCobro(format(new Date(), "yyyy-MM-dd"));
    setCuentaPagoId(cuentasPago[0]?.id || "");
    setReferencia("");
  };

  const closeCobroDialog = () => {
    setCuentaSeleccionada(null);
    setMontoCobro("");
    setCuentaPagoId("");
    setReferencia("");
  };

  const handleRegistrarCobro = async () => {
    if (!firestore || !user || !cuentaSeleccionada) return;

    const monto = Number(montoCobro);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast({ variant: "destructive", title: "Monto invalido", description: "Ingrese un monto mayor a cero." });
      return;
    }
    if (monto > Number(cuentaSeleccionada.saldoPendiente || 0) + 0.005) {
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: "El monto no puede superar el saldo pendiente.",
      });
      return;
    }
    if (!cuentaPagoId) {
      toast({
        variant: "destructive",
        title: "Cuenta requerida",
        description: "Seleccione la cuenta contable donde ingresa el cobro.",
      });
      return;
    }

    const fechaIso = parseDateInputToIso(fechaCobro);
    if (!fechaIso) {
      toast({ variant: "destructive", title: "Fecha invalida", description: "Verifique la fecha del cobro." });
      return;
    }

    const cuentaClientesId =
      cuentaSeleccionada.cuentaContableId ||
      findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.CLIENTES)?.id;
    if (!cuentaClientesId) {
      toast({
        variant: "destructive",
        title: "Cuenta clientes faltante",
        description: "No se encontro la cuenta contable base de clientes.",
      });
      return;
    }

    setIsSavingCobro(true);
    try {
      const cuentaRef = tenant.doc("cuentasPorCobrar", cuentaSeleccionada.id);
      const cobrosCol = tenant.collection("cobrosCxc");
      const recibosCol = tenant.collection("recibosCobro");
      const asientosCol = tenant.collection("asientosDiario");
      if (!cuentaRef || !cobrosCol || !recibosCol || !asientosCol) return;
      const cobroRef = doc(cobrosCol);
      const reciboRef = doc(recibosCol);
      const asientoRef = doc(asientosCol);
      const batch = writeBatch(firestore);

      const saldoResult = calcularSaldoDesdeMovimiento({
        montoOriginal: Number(cuentaSeleccionada.montoOriginal) || 0,
        montoAplicadoActual: Number(cuentaSeleccionada.montoCobrado) || 0,
        montoMovimiento: monto,
      });
      const estado = calcularEstadoCuenta({
        montoOriginal: Number(cuentaSeleccionada.montoOriginal) || 0,
        saldoPendiente: saldoResult.saldoPendiente,
        fechaVencimiento: cuentaSeleccionada.fechaVencimiento,
      });
      const fechaAsDate = toDateSafe(fechaIso) || new Date();
      const numeroRecibo = generarNumeroReciboCobro(fechaAsDate, cobroRef.id.slice(-4));
      const cuentaCajaBancoId = cuentasPago.find((option) => option.id === cuentaPagoId)?.cuentaCajaBancoId;

      const asientoData: Omit<AsientoDiario, "id"> = withZafraContext({
        fecha: fechaIso,
        descripcion: `Cobro recibo ${numeroRecibo} - venta ${cuentaSeleccionada.ventaDocumento || cuentaSeleccionada.ventaId}`,
        movimientos: [
          { cuentaId: cuentaPagoId, tipo: "debe", monto },
          { cuentaId: cuentaClientesId, tipo: "haber", monto },
        ],
      }, {
        zafraId: cuentaSeleccionada.zafraId,
        zafraNombre: cuentaSeleccionada.zafraNombre || null,
      });
      batch.set(asientoRef, asientoData);

      const cobroData: Omit<CobroCuentaPorCobrar, "id"> = {
        cuentaPorCobrarId: cuentaSeleccionada.id,
        ventaId: cuentaSeleccionada.ventaId,
        clienteId: cuentaSeleccionada.clienteId,
        zafraId: cuentaSeleccionada.zafraId,
        zafraNombre: cuentaSeleccionada.zafraNombre || null,
        fecha: fechaIso,
        moneda: cuentaSeleccionada.moneda,
        monto,
        cuentaContableId: cuentaPagoId,
        asientoId: asientoRef.id,
        reciboId: reciboRef.id,
        recibidoPor: user.uid,
        creadoEn: fechaIso,
        ...(cuentaCajaBancoId ? { cuentaCajaBancoId } : {}),
        ...(referencia ? { referencia } : {}),
      };
      batch.set(cobroRef, cobroData);

      const reciboData: Omit<ReciboCobro, "id"> = {
        numero: numeroRecibo,
        cobroId: cobroRef.id,
        cuentaPorCobrarId: cuentaSeleccionada.id,
        ventaId: cuentaSeleccionada.ventaId,
        clienteId: cuentaSeleccionada.clienteId,
        fecha: fechaIso,
        moneda: cuentaSeleccionada.moneda,
        monto,
        estado: "emitido",
        emitidoPor: user.uid,
        creadoEn: fechaIso,
        ...(referencia ? { observacion: referencia } : {}),
      };
      batch.set(reciboRef, reciboData);

      batch.update(cuentaRef, {
        montoCobrado: saldoResult.montoAplicado,
        saldoPendiente: saldoResult.saldoPendiente,
        estado,
        actualizadoEn: fechaIso,
      });

      await batch.commit();
      const clienteNombre = clientesById.get(cuentaSeleccionada.clienteId) || cuentaSeleccionada.clienteId;
      const cuentaIngreso = cuentasPago.find((option) => option.id === cuentaPagoId)?.label || cuentaPagoId;
      setUltimoRecibo({
        numero: numeroRecibo,
        fecha: fechaIso,
        clienteNombre,
        documento: cuentaSeleccionada.ventaDocumento || cuentaSeleccionada.ventaId,
        monto,
        moneda: cuentaSeleccionada.moneda,
        cuentaIngreso,
        estado: "emitido",
        ...(referencia ? { referencia } : {}),
      });
      setIsReciboOpen(true);
      toast({
        title: "Cobro registrado",
        description: `Se emitio el recibo ${numeroRecibo} por $${formatCurrency(monto)}.`,
      });
      closeCobroDialog();
      refetchCxc();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar el cobro",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSavingCobro(false);
    }
  };

  const isLoading = isLoadingCxc || isLoadingClientes;

  return (
    <>
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestione saldos pendientes de clientes, registre cobros y emita recibos."
      >
        <ReportActions reportTitle="Cuentas por Cobrar" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${formatCurrency(resumen.pendiente)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saldo Vencido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${formatCurrency(resumen.vencido)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cuentas Canceladas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{resumen.canceladas}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Antigüedad de Saldos (30/60/90)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={antiguedad}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString("de-DE")}`} />
                  <Tooltip formatter={(value: number) => `$${formatCurrency(Number(value))}`} />
                  <Bar dataKey="monto" fill={COMPARATIVE_CHART_COLORS.margen} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumen de Tramos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {antiguedad.map((bucket) => (
                <div key={bucket.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{bucket.label}</span>
                    <span>{bucket.cantidad} cuenta(s)</span>
                  </div>
                  <div className="text-xl font-semibold">${formatCurrency(bucket.monto)}</div>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Total antigüedad</span>
                  <span>${formatCurrency(totalAntiguedad)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4">
            <CardTitle>Detalle de cuentas</CardTitle>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente o documento..."
              />
              <Select value={estadoFiltro} onValueChange={(value) => setEstadoFiltro(value as EstadoFiltro)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center text-sm text-muted-foreground">
                Mostrando {cuentasFiltradas.length} de {(cuentasPorCobrar || []).length} cuentas.
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table resizable className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Zafra</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Emision</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      Cargando cuentas por cobrar...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  cuentasFiltradas.map((cuenta) => {
                    const emision = toDateSafe(cuenta.fechaEmision);
                    const vencimiento = toDateSafe(cuenta.fechaVencimiento);
                    const tieneSaldo = Number(cuenta.saldoPendiente || 0) > 0.005;
                    const puedeCobrar = tieneSaldo && cuenta.estado !== "anulada";

                    return (
                      <TableRow key={cuenta.id}>
                        <TableCell className="font-medium">{cuenta.ventaDocumento || cuenta.ventaId}</TableCell>
                        <TableCell>{cuenta.zafraNombre || "-"}</TableCell>
                        <TableCell>{clientesById.get(cuenta.clienteId) || "N/A"}</TableCell>
                        <TableCell>{emision ? format(emision, "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>{vencimiento ? format(vencimiento, "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.montoOriginal)}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.montoCobrado)}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.saldoPendiente)}</TableCell>
                        <TableCell>
                          <Badge className={cn("capitalize", getEstadoClassName(cuenta.estado))}>{cuenta.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openCobroDialog(cuenta)} disabled={!puedeCobrar}>
                            Registrar cobro
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!isLoading && cuentasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center h-24">
                      No hay cuentas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog modal={false} open={Boolean(cuentaSeleccionada)} onOpenChange={(open) => !open && closeCobroDialog()}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Registre cobro parcial o total y emita recibo automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Documento</p>
              <p className="font-medium">{cuentaSeleccionada?.ventaDocumento || cuentaSeleccionada?.ventaId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo pendiente</p>
              <p className="font-medium">${formatCurrency(cuentaSeleccionada?.saldoPendiente || 0)}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={montoCobro}
                  onChange={(event) => setMontoCobro(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha cobro</label>
                <Input type="date" value={fechaCobro} onChange={(event) => setFechaCobro(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cuenta de ingreso</label>
              <Select value={cuentaPagoId} onValueChange={setCuentaPagoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione cuenta contable" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasPago.length === 0 && (
                    <SelectItem value="sin-opciones" disabled>
                      No hay cuentas configuradas
                    </SelectItem>
                  )}
                  {cuentasPago.map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      {cuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Referencia (opcional)</label>
              <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCobroDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarCobro} disabled={isSavingCobro}>
              {isSavingCobro ? "Registrando..." : "Confirmar cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={isReciboOpen} onOpenChange={setIsReciboOpen}>
        <DialogContent draggable className="max-w-[96vw] overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>Recibo de Cobro Emitido</DialogTitle>
            <DialogDescription>
              Puede imprimir o descargar en PDF este recibo.
            </DialogDescription>
            <ReportActions
              reportTitle={ultimoRecibo ? `Recibo ${ultimoRecibo.numero}` : "Recibo de Cobro"}
              reportSummary={reciboSummary}
              imageTargetId={reciboTargetId}
              printTargetId={reciboTargetId}
              documentLabel="Recibo de Cobro"
              showDefaultFooter={false}
            />
          </DialogHeader>

          {ultimoRecibo && (
            <div className="max-h-[calc(92dvh-7rem)] overflow-y-auto overflow-x-hidden px-2 pb-4 sm:px-4 sm:pb-6">
              <ReciboCobroCard recibo={ultimoRecibo} />
            </div>
          )}

          {ultimoRecibo && (
            <div id={reciboTargetId} className="report-export-only">
              <ReciboCobroCard recibo={ultimoRecibo} />
            </div>
          )}

          <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6">
            <Button type="button" variant="outline" onClick={() => setIsReciboOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

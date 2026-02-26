"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { collection, doc, orderBy, query, where, writeBatch } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import {
  calcularAntiguedadSaldos,
  calcularEstadoCuenta,
  calcularSaldoDesdeMovimiento,
  toDateSafe,
} from "@/lib/cuentas";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import type {
  AsientoDiario,
  CuentaCajaBanco,
  CuentaPorPagar,
  PagoCuentaPorPagar,
  PlanDeCuenta,
  Proveedor,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

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

function getEstadoClassName(estado: CuentaPorPagar["estado"]): string {
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

export default function CuentasPagarPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorPagar | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [fechaPago, setFechaPago] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cuentaPagoId, setCuentaPagoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [isSavingPago, setIsSavingPago] = useState(false);

  const {
    data: cuentasPorPagar,
    isLoading: isLoadingCxp,
    forceRefetch: refetchCxp,
  } = useCollection<CuentaPorPagar>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "cuentasPorPagar"), orderBy("fechaEmision", "desc")) : null),
      [firestore]
    )
  );
  const { data: proveedores, isLoading: isLoadingProveedores } = useCollection<Proveedor>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "proveedores")) : null), [firestore])
  );
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "planDeCuentas"), orderBy("codigo")) : null),
      [firestore]
    )
  );
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "cuentasCajaBanco"), where("activo", "==", true)) : null),
      [firestore]
    )
  );

  const proveedoresById = useMemo(() => {
    return new Map((proveedores || []).map((proveedor) => [proveedor.id, proveedor.nombre]));
  }, [proveedores]);

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
    return (cuentasPorPagar || []).filter((cuenta) => {
      if (estadoFiltro !== "todos" && cuenta.estado !== estadoFiltro) return false;
      if (!term) return true;
      const proveedor = (proveedoresById.get(cuenta.proveedorId) || "").toLowerCase();
      const documento = (cuenta.compraDocumento || "").toLowerCase();
      return (
        proveedor.includes(term) ||
        documento.includes(term) ||
        cuenta.id.toLowerCase().includes(term) ||
        cuenta.compraId.toLowerCase().includes(term)
      );
    });
  }, [cuentasPorPagar, estadoFiltro, search, proveedoresById]);

  const resumen = useMemo(() => {
    const cuentas = cuentasPorPagar || [];
    const pendiente = cuentas.reduce((sum, cuenta) => sum + (cuenta.saldoPendiente || 0), 0);
    const vencido = cuentas
      .filter((cuenta) => cuenta.estado === "vencida")
      .reduce((sum, cuenta) => sum + (cuenta.saldoPendiente || 0), 0);
    const canceladas = cuentas.filter((cuenta) => cuenta.estado === "cancelada").length;
    return { pendiente, vencido, canceladas };
  }, [cuentasPorPagar]);

  const antiguedad = useMemo(() => calcularAntiguedadSaldos(cuentasPorPagar || []), [cuentasPorPagar]);
  const totalAntiguedad = useMemo(
    () => antiguedad.reduce((acc, bucket) => acc + bucket.monto, 0),
    [antiguedad]
  );

  const shareSummary = `Pendiente: $${formatCurrency(resumen.pendiente)} | Vencido: $${formatCurrency(
    resumen.vencido
  )} | Canceladas: ${resumen.canceladas}.`;

  const openPagoDialog = (cuenta: CuentaPorPagar) => {
    setCuentaSeleccionada(cuenta);
    setMontoPago(String(Number(cuenta.saldoPendiente || 0)));
    setFechaPago(format(new Date(), "yyyy-MM-dd"));
    setCuentaPagoId(cuentasPago[0]?.id || "");
    setReferencia("");
  };

  const closePagoDialog = () => {
    setCuentaSeleccionada(null);
    setMontoPago("");
    setCuentaPagoId("");
    setReferencia("");
  };

  const handleRegistrarPago = async () => {
    if (!firestore || !user || !cuentaSeleccionada) return;

    const monto = Number(montoPago);
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
        description: "Seleccione la cuenta contable desde donde se paga.",
      });
      return;
    }

    const fechaIso = parseDateInputToIso(fechaPago);
    if (!fechaIso) {
      toast({ variant: "destructive", title: "Fecha invalida", description: "Verifique la fecha del pago." });
      return;
    }

    const cuentaPasivoId =
      cuentaSeleccionada.cuentaContableId ||
      findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id;
    if (!cuentaPasivoId) {
      toast({
        variant: "destructive",
        title: "Cuenta proveedores faltante",
        description: "No se encontro la cuenta contable base de proveedores.",
      });
      return;
    }

    setIsSavingPago(true);
    try {
      const cuentaRef = doc(firestore, "cuentasPorPagar", cuentaSeleccionada.id);
      const pagoRef = doc(collection(firestore, "pagosCxp"));
      const asientoRef = doc(collection(firestore, "asientosDiario"));
      const compraRef = doc(firestore, "comprasNormal", cuentaSeleccionada.compraId);
      const batch = writeBatch(firestore);

      const saldoResult = calcularSaldoDesdeMovimiento({
        montoOriginal: Number(cuentaSeleccionada.montoOriginal) || 0,
        montoAplicadoActual: Number(cuentaSeleccionada.montoPagado) || 0,
        montoMovimiento: monto,
      });
      const estado = calcularEstadoCuenta({
        montoOriginal: Number(cuentaSeleccionada.montoOriginal) || 0,
        saldoPendiente: saldoResult.saldoPendiente,
        fechaVencimiento: cuentaSeleccionada.fechaVencimiento,
      });
      const cuentaCajaBancoId = cuentasPago.find((option) => option.id === cuentaPagoId)?.cuentaCajaBancoId;

      const asientoData: Omit<AsientoDiario, "id"> = {
        fecha: fechaIso,
        descripcion: `Pago cuenta ${cuentaSeleccionada.compraDocumento || cuentaSeleccionada.compraId}`,
        movimientos: [
          { cuentaId: cuentaPasivoId, tipo: "debe", monto },
          { cuentaId: cuentaPagoId, tipo: "haber", monto },
        ],
      };
      batch.set(asientoRef, asientoData);

      const pagoData: Omit<PagoCuentaPorPagar, "id"> = {
        cuentaPorPagarId: cuentaSeleccionada.id,
        compraId: cuentaSeleccionada.compraId,
        proveedorId: cuentaSeleccionada.proveedorId,
        fecha: fechaIso,
        moneda: cuentaSeleccionada.moneda,
        monto,
        cuentaContableId: cuentaPagoId,
        asientoId: asientoRef.id,
        pagadoPor: user.uid,
        creadoEn: fechaIso,
        ...(cuentaCajaBancoId ? { cuentaCajaBancoId } : {}),
        ...(referencia ? { referencia } : {}),
      };
      batch.set(pagoRef, pagoData);

      batch.update(cuentaRef, {
        montoPagado: saldoResult.montoAplicado,
        saldoPendiente: saldoResult.saldoPendiente,
        estado,
        actualizadoEn: fechaIso,
      });

      const saldoCancelado = saldoResult.saldoPendiente <= 0.005;
      batch.update(compraRef, {
        "financiero.pagoAplicado": saldoCancelado,
        "financiero.cuentaPagoId": cuentaPagoId,
        "financiero.asientoPagoId": asientoRef.id,
        "financiero.fechaPago": fechaIso,
      });

      await batch.commit();
      toast({
        title: "Pago registrado",
        description: `Se registro pago por $${formatCurrency(monto)}.`,
      });
      closePagoDialog();
      refetchCxp();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar el pago",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSavingPago(false);
    }
  };

  const isLoading = isLoadingCxp || isLoadingProveedores;

  return (
    <>
      <PageHeader
        title="Cuentas por Pagar"
        description="Gestione saldos pendientes a proveedores y registre pagos parciales o totales."
      >
        <ReportActions reportTitle="Cuentas por Pagar" reportSummary={shareSummary} />
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
                  <Bar dataKey="monto" fill={COMPARATIVE_CHART_COLORS.costo} radius={[4, 4, 0, 0]} />
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
                placeholder="Buscar por proveedor o documento..."
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
                Mostrando {cuentasFiltradas.length} de {(cuentasPorPagar || []).length} cuentas.
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Emision</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Cargando cuentas por pagar...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  cuentasFiltradas.map((cuenta) => {
                    const emision = toDateSafe(cuenta.fechaEmision);
                    const vencimiento = toDateSafe(cuenta.fechaVencimiento);
                    const tieneSaldo = Number(cuenta.saldoPendiente || 0) > 0.005;
                    const puedePagar = tieneSaldo && cuenta.estado !== "anulada";

                    return (
                      <TableRow key={cuenta.id}>
                        <TableCell className="font-medium">{cuenta.compraDocumento || cuenta.compraId}</TableCell>
                        <TableCell>{proveedoresById.get(cuenta.proveedorId) || "N/A"}</TableCell>
                        <TableCell>{emision ? format(emision, "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>{vencimiento ? format(vencimiento, "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.montoOriginal)}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.montoPagado)}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(cuenta.saldoPendiente)}</TableCell>
                        <TableCell>
                          <Badge className={cn("capitalize", getEstadoClassName(cuenta.estado))}>{cuenta.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openPagoDialog(cuenta)} disabled={!puedePagar}>
                            Registrar pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!isLoading && cuentasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">
                      No hay cuentas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(cuentaSeleccionada)} onOpenChange={(open) => !open && closePagoDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Registre pago parcial o total y actualice automaticamente la cuenta por pagar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Documento</p>
              <p className="font-medium">{cuentaSeleccionada?.compraDocumento || cuentaSeleccionada?.compraId}</p>
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
                  value={montoPago}
                  onChange={(event) => setMontoPago(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha pago</label>
                <Input type="date" value={fechaPago} onChange={(event) => setFechaPago(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cuenta de egreso</label>
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
            <Button variant="outline" onClick={closePagoDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPago} disabled={isSavingPago}>
              {isSavingPago ? "Registrando..." : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

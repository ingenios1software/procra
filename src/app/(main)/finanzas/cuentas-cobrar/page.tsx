"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { collection, doc, orderBy, query, where, writeBatch } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Printer } from "lucide-react";
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
  generarNumeroReciboCobro,
  toDateSafe,
} from "@/lib/cuentas";
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

type ReciboPreview = {
  numero: string;
  fecha: string;
  clienteNombre: string;
  documento: string;
  monto: number;
  moneda: "USD" | "PYG";
  cuentaIngreso: string;
  referencia?: string;
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
  const firestore = useFirestore();
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
  const [ultimoRecibo, setUltimoRecibo] = useState<ReciboPreview | null>(null);
  const [isReciboOpen, setIsReciboOpen] = useState(false);
  const reciboRef = useRef<HTMLDivElement | null>(null);

  const {
    data: cuentasPorCobrar,
    isLoading: isLoadingCxc,
    forceRefetch: refetchCxc,
  } = useCollection<CuentaPorCobrar>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "cuentasPorCobrar"), orderBy("fechaEmision", "desc")) : null),
      [firestore]
    )
  );
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "clientes")) : null), [firestore])
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

  const handleImprimirRecibo = () => {
    if (!reciboRef.current || !ultimoRecibo) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      toast({
        variant: "destructive",
        title: "No se pudo abrir impresion",
        description: "Habilite ventanas emergentes para imprimir el recibo.",
      });
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Recibo ${ultimoRecibo.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            .recibo-wrap { max-width: 760px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
            .head { display: flex; justify-content: space-between; margin-bottom: 16px; }
            .title { font-size: 22px; font-weight: 700; }
            .meta { font-size: 12px; color: #666; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
            .label { font-size: 12px; color: #666; margin-bottom: 2px; }
            .value { font-size: 14px; font-weight: 600; }
            .amount { font-size: 28px; font-weight: 800; margin: 8px 0 2px; }
            .footer { margin-top: 26px; font-size: 12px; color: #555; border-top: 1px dashed #bbb; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="recibo-wrap">
            ${reciboRef.current.innerHTML}
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
  };

  const handleDescargarReciboPdf = async () => {
    if (!reciboRef.current || !ultimoRecibo) return;
    try {
      const canvas = await html2canvas(reciboRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * maxWidth) / canvas.width;
      const renderHeight = Math.min(imgHeight, pageHeight - margin * 2);
      pdf.addImage(imgData, "PNG", margin, margin, maxWidth, renderHeight);
      const safeNumber = ultimoRecibo.numero.replace(/[^\w-]/g, "_");
      pdf.save(`Recibo_${safeNumber}.pdf`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo generar PDF",
        description: error?.message || "Error al exportar el recibo.",
      });
    }
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
      const cuentaRef = doc(firestore, "cuentasPorCobrar", cuentaSeleccionada.id);
      const cobroRef = doc(collection(firestore, "cobrosCxc"));
      const reciboRef = doc(collection(firestore, "recibosCobro"));
      const asientoRef = doc(collection(firestore, "asientosDiario"));
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

      const asientoData: Omit<AsientoDiario, "id"> = {
        fecha: fechaIso,
        descripcion: `Cobro recibo ${numeroRecibo} - venta ${cuentaSeleccionada.ventaDocumento || cuentaSeleccionada.ventaId}`,
        movimientos: [
          { cuentaId: cuentaPagoId, tipo: "debe", monto },
          { cuentaId: cuentaClientesId, tipo: "haber", monto },
        ],
      };
      batch.set(asientoRef, asientoData);

      const cobroData: Omit<CobroCuentaPorCobrar, "id"> = {
        cuentaPorCobrarId: cuentaSeleccionada.id,
        ventaId: cuentaSeleccionada.ventaId,
        clienteId: cuentaSeleccionada.clienteId,
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
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
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
                    <TableCell colSpan={9} className="text-center">
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
        <DialogContent draggable className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recibo de Cobro Emitido</DialogTitle>
            <DialogDescription>
              Puede imprimir o descargar en PDF este recibo.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={reciboRef}
            className="rounded-md border bg-white p-5 text-black"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Recibo de cobro</p>
                <p className="text-2xl font-bold">{ultimoRecibo?.numero || "-"}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">Fecha</p>
                <p className="font-semibold">
                  {ultimoRecibo?.fecha ? format(new Date(ultimoRecibo.fecha), "dd/MM/yyyy HH:mm") : "-"}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-semibold">{ultimoRecibo?.clienteNombre || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Documento de venta</p>
                <p className="font-semibold">{ultimoRecibo?.documento || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cuenta de ingreso</p>
                <p className="font-semibold">{ultimoRecibo?.cuentaIngreso || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Referencia</p>
                <p className="font-semibold">{ultimoRecibo?.referencia || "-"}</p>
              </div>
            </div>
            <div className="mt-5 border-t pt-4">
              <p className="text-xs text-gray-500">Monto cobrado</p>
              <p className="text-3xl font-extrabold">
                {ultimoRecibo?.moneda || "USD"} ${formatCurrency(ultimoRecibo?.monto || 0)}
              </p>
            </div>
            <div className="mt-6 border-t border-dashed pt-3 text-xs text-gray-500">
              Emitido por sistema CRApro95.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsReciboOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" variant="outline" onClick={handleImprimirRecibo}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button type="button" onClick={handleDescargarReciboPdf}>
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

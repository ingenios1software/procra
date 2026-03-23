"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { doc, limit, orderBy, where, writeBatch } from "firebase/firestore";
import { ArrowLeftRight, Landmark, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { CashBankExtract } from "@/components/finanzas/cash-bank-extract";
import { FinancialOperationWindow } from "@/components/finanzas/financial-operation-window";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { toDateSafe } from "@/lib/cuentas";
import type {
  AsientoDiario,
  CobroCuentaPorCobrar,
  CuentaCajaBanco,
  MedioMovimientoTesoreria,
  Moneda,
  MovimientoTesoreria,
  PagoCuentaPorPagar,
  PlanDeCuenta,
  TipoOperacionTesoreria,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

type CuentaFinancieraOption = {
  id: string;
  tipo: CuentaCajaBanco["tipo"];
  nombre: string;
  moneda: "USD" | "PYG" | null;
  cuentaContableId: string;
  cuentaContableCodigo: string;
  cuentaContableNombre: string;
  label: string;
};

const TIPO_OPTIONS: Array<{ value: TipoOperacionTesoreria; label: string }> = [
  { value: "traspaso", label: "Traspaso entre cuentas" },
  { value: "egreso", label: "Egreso de caja/banco" },
  { value: "ingreso", label: "Ingreso a caja/banco" },
];

const MEDIO_OPTIONS: Array<{ value: MedioMovimientoTesoreria; label: string }> = [
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "efectivo", label: "Efectivo" },
];

function parseDateInputToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMonedaCodigo(monedaId: string | undefined, monedasById: Map<string, Moneda>): "USD" | "PYG" | null {
  if (!monedaId) return null;
  const moneda = monedasById.get(monedaId);
  const base = `${moneda?.codigo || ""} ${moneda?.descripcion || ""} ${monedaId}`.toUpperCase();
  if (base.includes("USD")) return "USD";
  if (base.includes("PYG") || base.includes("GS") || base.includes("GUARANI")) return "PYG";
  return null;
}

function toMonthAmount<T extends { fecha: Date | string; monto: number }>(items: T[] | null | undefined): number {
  const inicioMes = startOfMonth(new Date());
  return (items || []).reduce((sum, item) => {
    const fecha = toDateSafe(item.fecha);
    if (!fecha || fecha < inicioMes) return sum;
    return sum + (Number(item.monto) || 0);
  }, 0);
}

export default function TesoreriaPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const { toast } = useToast();

  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacionTesoreria>("traspaso");
  const [medio, setMedio] = useState<MedioMovimientoTesoreria>("transferencia");
  const [fechaOperacion, setFechaOperacion] = useState(format(new Date(), "yyyy-MM-dd"));
  const [monto, setMonto] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState("");
  const [cuentaDestinoId, setCuentaDestinoId] = useState("");
  const [cuentaContrapartidaId, setCuentaContrapartidaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(
      () => tenant.query("planDeCuentas", orderBy("codigo")),
      [tenant]
    )
  );
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(
    useMemoFirebase(
      () => tenant.query("cuentasCajaBanco", orderBy("nombre")),
      [tenant]
    )
  );
  const { data: monedas } = useCollection<Moneda>(
    useMemoFirebase(() => tenant.collection("monedas"), [tenant])
  );
  const {
    data: movimientosTesoreria,
    isLoading: isLoadingMovs,
    forceRefetch: refetchMovs,
  } = useCollection<MovimientoTesoreria>(
    useMemoFirebase(
      () => tenant.query("movimientosTesoreria", orderBy("fecha", "desc"), limit(200)),
      [tenant]
    )
  );
  const { data: cobrosCxc } = useCollection<CobroCuentaPorCobrar>(
    useMemoFirebase(
      () => tenant.query("cobrosCxc", orderBy("fecha", "desc"), limit(500)),
      [tenant]
    )
  );
  const { data: pagosCxp } = useCollection<PagoCuentaPorPagar>(
    useMemoFirebase(
      () => tenant.query("pagosCxp", orderBy("fecha", "desc"), limit(500)),
      [tenant]
    )
  );

  const planById = useMemo(() => new Map((planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta])), [planDeCuentas]);
  const monedasById = useMemo(() => new Map((monedas || []).map((moneda) => [moneda.id, moneda])), [monedas]);

  const cuentasFinancieras = useMemo<CuentaFinancieraOption[]>(() => {
    const options: CuentaFinancieraOption[] = [];
    for (const cuentaCajaBanco of cuentasCajaBanco || []) {
      if (!cuentaCajaBanco.activo) continue;
      if (!cuentaCajaBanco.cuentaContableId) continue;
      const cuentaContable = planById.get(cuentaCajaBanco.cuentaContableId);
      if (!cuentaContable) continue;
      let moneda = getMonedaCodigo(cuentaCajaBanco.monedaId, monedasById);
      if (!moneda) {
        const hint = normalizeText(cuentaCajaBanco.nombre);
        if (hint.includes("usd") || hint.includes("u$") || hint.includes("dolar")) moneda = "USD";
        if (hint.includes("gs") || hint.includes("guarani")) moneda = "PYG";
      }
      options.push({
        id: cuentaCajaBanco.id,
        tipo: cuentaCajaBanco.tipo,
        nombre: cuentaCajaBanco.nombre,
        moneda,
        cuentaContableId: cuentaContable.id,
        cuentaContableCodigo: cuentaContable.codigo,
        cuentaContableNombre: cuentaContable.nombre,
        label: `${cuentaCajaBanco.tipo} ${cuentaCajaBanco.nombre} - ${cuentaContable.codigo} - ${cuentaContable.nombre}`,
      });
    }
    return options;
  }, [cuentasCajaBanco, planById, monedasById]);

  const cuentasFinancierasById = useMemo(
    () => new Map(cuentasFinancieras.map((cuenta) => [cuenta.id, cuenta])),
    [cuentasFinancieras]
  );

  const cuentaJornalesSugeridaId = useMemo(() => {
    return (
      (planDeCuentas || []).find((cuenta) => {
        const name = normalizeText(`${cuenta.codigo} ${cuenta.nombre}`);
        return name.includes("jornal") || name.includes("sueldo");
      })?.id || ""
    );
  }, [planDeCuentas]);

  const cuentasContrapartida = useMemo(() => {
    const all = planDeCuentas || [];
    if (tipoOperacion === "egreso") {
      return all.filter((cuenta) => ["gasto", "costo", "pasivo"].includes(cuenta.tipo));
    }
    if (tipoOperacion === "ingreso") {
      return all.filter((cuenta) => ["ingreso", "pasivo"].includes(cuenta.tipo));
    }
    return [] as PlanDeCuenta[];
  }, [planDeCuentas, tipoOperacion]);

  useEffect(() => {
    if (cuentasFinancieras.length === 0) return;
    if (!cuentaOrigenId) {
      const banco = cuentasFinancieras.find((cuenta) => cuenta.tipo === "BANCO");
      setCuentaOrigenId((banco || cuentasFinancieras[0]).id);
    }
    if (!cuentaDestinoId) {
      const cajaJornaleros = cuentasFinancieras.find((cuenta) => {
        if (cuenta.tipo !== "CAJA") return false;
        return normalizeText(cuenta.nombre).includes("jornal");
      });
      const caja = cuentasFinancieras.find((cuenta) => cuenta.tipo === "CAJA");
      setCuentaDestinoId((cajaJornaleros || caja || cuentasFinancieras[0]).id);
    }
  }, [cuentasFinancieras, cuentaOrigenId, cuentaDestinoId]);

  useEffect(() => {
    if (tipoOperacion === "egreso" && !cuentaContrapartidaId && cuentaJornalesSugeridaId) {
      setCuentaContrapartidaId(cuentaJornalesSugeridaId);
    }
  }, [tipoOperacion, cuentaContrapartidaId, cuentaJornalesSugeridaId]);

  const totalCobradoMes = useMemo(() => toMonthAmount(cobrosCxc), [cobrosCxc]);
  const totalPagadoMes = useMemo(() => toMonthAmount(pagosCxp), [pagosCxp]);

  const resumenTesoreriaMes = useMemo(() => {
    const inicioMes = startOfMonth(new Date());
    const resumen = {
      ingresos: 0,
      egresos: 0,
      traspasos: 0,
    };
    for (const mov of movimientosTesoreria || []) {
      const fecha = toDateSafe(mov.fecha);
      if (!fecha || fecha < inicioMes) continue;
      const montoMov = Number(mov.monto) || 0;
      if (mov.tipoOperacion === "ingreso") resumen.ingresos += montoMov;
      if (mov.tipoOperacion === "egreso") resumen.egresos += montoMov;
      if (mov.tipoOperacion === "traspaso") resumen.traspasos += montoMov;
    }
    return resumen;
  }, [movimientosTesoreria]);

  const shareSummary = `Cobros mes: $${formatCurrency(totalCobradoMes)} | Pagos mes: $${formatCurrency(
    totalPagadoMes
  )} | Traspasos mes: $${formatCurrency(resumenTesoreriaMes.traspasos)}.`;

  const getCuentaFinancieraLabel = (id?: string): string => {
    if (!id) return "-";
    return cuentasFinancierasById.get(id)?.label || id;
  };

  const getCuentaContableLabel = (id?: string): string => {
    if (!id) return "-";
    const cuenta = planById.get(id);
    return cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : id;
  };

  const resetForm = () => {
    setMonto("");
    setDescripcion("");
    setReferencia("");
  };

  const handleRegistrarMovimiento = async () => {
    if (!firestore || !user) return;

    const montoValue = Number(monto);
    if (!Number.isFinite(montoValue) || montoValue <= 0) {
      toast({ variant: "destructive", title: "Monto invalido", description: "Ingrese un monto mayor a cero." });
      return;
    }

    const fechaIso = parseDateInputToIso(fechaOperacion);
    if (!fechaIso) {
      toast({ variant: "destructive", title: "Fecha invalida", description: "Verifique la fecha." });
      return;
    }

    const origen = cuentaOrigenId ? cuentasFinancierasById.get(cuentaOrigenId) : undefined;
    const destino = cuentaDestinoId ? cuentasFinancierasById.get(cuentaDestinoId) : undefined;
    const contrapartida = cuentaContrapartidaId ? planById.get(cuentaContrapartidaId) : undefined;

    let moneda: "USD" | "PYG" | null = null;
    let descripcionFinal = descripcion.trim();
    let movimientosAsiento: AsientoDiario["movimientos"] = [];
    let payload: Omit<MovimientoTesoreria, "id"> | null = null;

    if (tipoOperacion === "traspaso") {
      if (!origen || !destino) {
        toast({
          variant: "destructive",
          title: "Cuentas requeridas",
          description: "Seleccione cuenta origen y cuenta destino.",
        });
        return;
      }
      if (origen.id === destino.id) {
        toast({
          variant: "destructive",
          title: "Cuentas iguales",
          description: "Origen y destino no pueden ser la misma cuenta.",
        });
        return;
      }
      if (!origen.moneda || !destino.moneda || origen.moneda !== destino.moneda) {
        toast({
          variant: "destructive",
          title: "Moneda incompatible",
          description: "El traspaso requiere que ambas cuentas tengan la misma moneda.",
        });
        return;
      }
      if (medio === "cheque" && !(origen.tipo === "BANCO" && destino.tipo === "CAJA")) {
        toast({
          variant: "destructive",
          title: "Cheque invalido",
          description: "El cheque se usa para retiro de BANCO a CAJA.",
        });
        return;
      }
      moneda = origen.moneda;
      if (!descripcionFinal) {
        descripcionFinal = `Traspaso ${origen.nombre} -> ${destino.nombre}`;
      }
      movimientosAsiento = [
        { cuentaId: destino.cuentaContableId, tipo: "debe", monto: montoValue },
        { cuentaId: origen.cuentaContableId, tipo: "haber", monto: montoValue },
      ];
      payload = {
        fecha: fechaIso,
        tipoOperacion,
        medio,
        moneda,
        monto: montoValue,
        descripcion: descripcionFinal,
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        cuentaOrigenCajaBancoId: origen.id,
        cuentaOrigenContableId: origen.cuentaContableId,
        cuentaDestinoCajaBancoId: destino.id,
        cuentaDestinoContableId: destino.cuentaContableId,
      };
    }

    if (tipoOperacion === "egreso") {
      if (!origen) {
        toast({
          variant: "destructive",
          title: "Cuenta origen requerida",
          description: "Seleccione la cuenta desde donde sale el dinero.",
        });
        return;
      }
      if (!contrapartida) {
        toast({
          variant: "destructive",
          title: "Contrapartida requerida",
          description: "Seleccione la cuenta de gasto/pasivo que recibe el cargo.",
        });
        return;
      }
      if (!origen.moneda) {
        toast({
          variant: "destructive",
          title: "Moneda no definida",
          description: "La cuenta origen no tiene moneda valida configurada.",
        });
        return;
      }
      moneda = origen.moneda;
      if (!descripcionFinal) {
        descripcionFinal = `Egreso desde ${origen.nombre}`;
      }
      movimientosAsiento = [
        { cuentaId: contrapartida.id, tipo: "debe", monto: montoValue },
        { cuentaId: origen.cuentaContableId, tipo: "haber", monto: montoValue },
      ];
      payload = {
        fecha: fechaIso,
        tipoOperacion,
        medio,
        moneda,
        monto: montoValue,
        descripcion: descripcionFinal,
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        cuentaOrigenCajaBancoId: origen.id,
        cuentaOrigenContableId: origen.cuentaContableId,
        cuentaContrapartidaId: contrapartida.id,
      };
    }

    if (tipoOperacion === "ingreso") {
      if (!destino) {
        toast({
          variant: "destructive",
          title: "Cuenta destino requerida",
          description: "Seleccione la cuenta donde ingresa el dinero.",
        });
        return;
      }
      if (!contrapartida) {
        toast({
          variant: "destructive",
          title: "Contrapartida requerida",
          description: "Seleccione la cuenta de ingreso/pasivo.",
        });
        return;
      }
      if (!destino.moneda) {
        toast({
          variant: "destructive",
          title: "Moneda no definida",
          description: "La cuenta destino no tiene moneda valida configurada.",
        });
        return;
      }
      moneda = destino.moneda;
      if (!descripcionFinal) {
        descripcionFinal = `Ingreso a ${destino.nombre}`;
      }
      movimientosAsiento = [
        { cuentaId: destino.cuentaContableId, tipo: "debe", monto: montoValue },
        { cuentaId: contrapartida.id, tipo: "haber", monto: montoValue },
      ];
      payload = {
        fecha: fechaIso,
        tipoOperacion,
        medio,
        moneda,
        monto: montoValue,
        descripcion: descripcionFinal,
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        cuentaDestinoCajaBancoId: destino.id,
        cuentaDestinoContableId: destino.cuentaContableId,
        cuentaContrapartidaId: contrapartida.id,
      };
    }

    if (!payload || !moneda || movimientosAsiento.length === 0) {
      toast({
        variant: "destructive",
        title: "Movimiento incompleto",
        description: "No se pudo construir el movimiento. Revise los datos.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const movimientosCol = tenant.collection("movimientosTesoreria");
      const asientosCol = tenant.collection("asientosDiario");
      if (!movimientosCol || !asientosCol) return;
      const movimientoRef = doc(movimientosCol);
      const asientoRef = doc(asientosCol);
      const asientoData: Omit<AsientoDiario, "id"> = {
        fecha: fechaIso,
        descripcion: descripcionFinal,
        movimientos: movimientosAsiento,
      };
      batch.set(asientoRef, asientoData);
      batch.set(movimientoRef, {
        ...payload,
        asientoId: asientoRef.id,
        creadoPor: user.uid,
        creadoEn: fechaIso,
      });
      await batch.commit();

      toast({
        title: "Movimiento registrado",
        description: `${tipoOperacion.toUpperCase()} por ${moneda} $${formatCurrency(montoValue)}.`,
      });
      resetForm();
      refetchMovs();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description: error?.message || "Error inesperado al guardar movimiento.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = isLoadingMovs;

  return (
    <>
      <PageHeader
        title="Tesoreria y Caja"
        description="Estructure ingresos, egresos y traspasos entre bancos y cajas (incluye retiro por cheque a caja jornaleros)."
      >
        <ReportActions reportTitle="Tesoreria y Caja" reportSummary={shareSummary} />
      </PageHeader>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobros del mes</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-semibold">${formatCurrency(totalCobradoMes)}</p>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pagos del mes</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-semibold">${formatCurrency(totalPagadoMes)}</p>
              <Landmark className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Traspasos del mes</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-semibold">${formatCurrency(resumenTesoreriaMes.traspasos)}</p>
              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Neto tesoreria mes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                ${formatCurrency(resumenTesoreriaMes.ingresos - resumenTesoreriaMes.egresos)}
              </p>
              <p className="text-xs text-muted-foreground">
                Ingresos - Egresos (movimientos manuales)
              </p>
            </CardContent>
          </Card>
        </div>

        <FinancialOperationWindow
          planDeCuentas={planDeCuentas}
          cuentasCajaBanco={cuentasCajaBanco}
          monedas={monedas}
        />

        <CashBankExtract
          planDeCuentas={planDeCuentas}
          cuentasCajaBanco={cuentasCajaBanco}
          monedas={monedas}
        />

        <Card>
          <CardHeader>
            <CardTitle>Registrar movimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo de operacion</label>
                <Select value={tipoOperacion} onValueChange={(value) => setTipoOperacion(value as TipoOperacionTesoreria)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Medio</label>
                <Select value={medio} onValueChange={(value) => setMedio(value as MedioMovimientoTesoreria)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha</label>
                <Input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Monto</label>
                <Input type="number" min={0} step="0.01" value={monto} onChange={(event) => setMonto(event.target.value)} />
              </div>
            </div>

            {tipoOperacion !== "ingreso" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Cuenta origen (caja/banco)</label>
                <Select value={cuentaOrigenId} onValueChange={setCuentaOrigenId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione cuenta origen" /></SelectTrigger>
                  <SelectContent>
                    {cuentasFinancieras.map((cuenta) => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>{cuenta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoOperacion !== "egreso" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Cuenta destino (caja/banco)</label>
                <Select value={cuentaDestinoId} onValueChange={setCuentaDestinoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione cuenta destino" /></SelectTrigger>
                  <SelectContent>
                    {cuentasFinancieras.map((cuenta) => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>{cuenta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoOperacion !== "traspaso" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Cuenta contrapartida</label>
                <Select value={cuentaContrapartidaId} onValueChange={setCuentaContrapartidaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione cuenta contrapartida" /></SelectTrigger>
                  <SelectContent>
                    {cuentasContrapartida.map((cuenta) => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>
                        {cuenta.codigo} - {cuenta.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Descripcion</label>
                <Input
                  placeholder="Ej: Retiro por cheque para caja jornaleros"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Referencia (opcional)</label>
                <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} />
              </div>
            </div>

            {tipoOperacion === "traspaso" && medio === "cheque" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Para retiro por cheque use origen BANCO y destino CAJA (ejemplo: Caja Jornaleros PYG).
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleRegistrarMovimiento} disabled={isSaving || cuentasFinancieras.length === 0}>
                {isSaving ? "Guardando..." : "Registrar movimiento"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table resizable className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino / Contrapartida</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Cargando movimientos...</TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  (movimientosTesoreria || []).map((movimiento) => {
                    const fecha = toDateSafe(movimiento.fecha);
                    const tipoDestino =
                      movimiento.tipoOperacion === "traspaso" || movimiento.tipoOperacion === "ingreso"
                        ? getCuentaFinancieraLabel(movimiento.cuentaDestinoCajaBancoId)
                        : getCuentaContableLabel(movimiento.cuentaContrapartidaId);

                    return (
                      <TableRow key={movimiento.id}>
                        <TableCell>{fecha ? format(fecha, "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {movimiento.tipoOperacion}
                          </Badge>
                        </TableCell>
                        <TableCell className="uppercase">{movimiento.medio}</TableCell>
                        <TableCell>{movimiento.descripcion}</TableCell>
                        <TableCell>
                          {movimiento.tipoOperacion === "ingreso"
                            ? getCuentaContableLabel(movimiento.cuentaContrapartidaId)
                            : getCuentaFinancieraLabel(movimiento.cuentaOrigenCajaBancoId)}
                        </TableCell>
                        <TableCell>{tipoDestino}</TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(movimiento.monto)}</TableCell>
                        <TableCell>{movimiento.moneda}</TableCell>
                      </TableRow>
                    );
                  })}

                {!isLoading && (movimientosTesoreria || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-20 text-center">
                      Sin movimientos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

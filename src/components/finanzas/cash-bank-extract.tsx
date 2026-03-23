"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, startOfMonth } from "date-fns";
import { orderBy } from "firebase/firestore";
import { ArrowDownToLine, ArrowUpToLine, Landmark, Receipt, Wallet } from "lucide-react";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateSafe } from "@/lib/cuentas";
import type {
  Cliente,
  CobroCuentaPorCobrar,
  CuentaCajaBanco,
  Moneda,
  MovimientoTesoreria,
  PagoCuentaPorPagar,
  PlanDeCuenta,
  Proveedor,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

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

type ExtractLine = {
  id: string;
  fecha: Date;
  fechaIso: string;
  origen: "movimiento" | "cobro" | "pago";
  descripcion: string;
  referencia: string;
  documento: string;
  ingreso: number;
  egreso: number;
};

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

function parseInputDate(value: string, mode: "start" | "end"): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return mode === "start" ? startOfDay(parsed) : endOfDay(parsed);
}

function toSignedBalance(line: ExtractLine): number {
  return line.ingreso - line.egreso;
}

export function CashBankExtract({
  planDeCuentas,
  cuentasCajaBanco,
  monedas,
}: {
  planDeCuentas: PlanDeCuenta[] | null | undefined;
  cuentasCajaBanco: CuentaCajaBanco[] | null | undefined;
  monedas: Moneda[] | null | undefined;
}) {
  const tenant = useTenantFirestore();
  const { user } = useUser();
  const [selectedCuentaId, setSelectedCuentaId] = useState("");
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: movimientosTesoreria, isLoading: l1 } = useCollection<MovimientoTesoreria>(
    useMemoFirebase(() => tenant.query("movimientosTesoreria", orderBy("fecha", "asc")), [tenant])
  );
  const { data: cobrosCxc, isLoading: l2 } = useCollection<CobroCuentaPorCobrar>(
    useMemoFirebase(() => tenant.query("cobrosCxc", orderBy("fecha", "asc")), [tenant])
  );
  const { data: pagosCxp, isLoading: l3 } = useCollection<PagoCuentaPorPagar>(
    useMemoFirebase(() => tenant.query("pagosCxp", orderBy("fecha", "asc")), [tenant])
  );
  const { data: clientes, isLoading: l4 } = useCollection<Cliente>(
    useMemoFirebase(() => tenant.query("clientes", orderBy("nombre", "asc")), [tenant])
  );
  const { data: proveedores, isLoading: l5 } = useCollection<Proveedor>(
    useMemoFirebase(() => tenant.query("proveedores", orderBy("nombre", "asc")), [tenant])
  );

  const planById = useMemo(() => new Map((planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta])), [planDeCuentas]);
  const monedasById = useMemo(() => new Map((monedas || []).map((moneda) => [moneda.id, moneda])), [monedas]);
  const clientesById = useMemo(() => new Map((clientes || []).map((cliente) => [cliente.id, cliente.nombre])), [clientes]);
  const proveedoresById = useMemo(() => new Map((proveedores || []).map((proveedor) => [proveedor.id, proveedor.nombre])), [proveedores]);

  const cuentasFinancieras = useMemo<CuentaFinancieraOption[]>(() => {
    const options: CuentaFinancieraOption[] = [];
    for (const cuentaCajaBanco of cuentasCajaBanco || []) {
      if (!cuentaCajaBanco.activo || !cuentaCajaBanco.cuentaContableId) continue;
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
  }, [cuentasCajaBanco, monedasById, planById]);

  useEffect(() => {
    if (selectedCuentaId) return;
    if (cuentasFinancieras.length > 0) {
      setSelectedCuentaId(cuentasFinancieras[0].id);
    }
  }, [cuentasFinancieras, selectedCuentaId]);

  const selectedCuenta = useMemo(
    () => cuentasFinancieras.find((cuenta) => cuenta.id === selectedCuentaId) || null,
    [cuentasFinancieras, selectedCuentaId]
  );

  const desdeDate = useMemo(() => parseInputDate(desde, "start"), [desde]);
  const hastaDate = useMemo(() => parseInputDate(hasta, "end"), [hasta]);

  const allLines = useMemo<ExtractLine[]>(() => {
    if (!selectedCuentaId) return [];

    const lines: ExtractLine[] = [];

    for (const movimiento of movimientosTesoreria || []) {
      const fecha = toDateSafe(movimiento.fecha);
      if (!fecha) continue;

      if (movimiento.tipoOperacion === "ingreso" && movimiento.cuentaDestinoCajaBancoId === selectedCuentaId) {
        lines.push({
          id: `mov-ingreso-${movimiento.id}`,
          fecha,
          fechaIso: fecha.toISOString(),
          origen: "movimiento",
          descripcion: movimiento.descripcion || "Ingreso de tesoreria",
          referencia: movimiento.referencia || "",
          documento: movimiento.asientoId || movimiento.id,
          ingreso: Number(movimiento.monto) || 0,
          egreso: 0,
        });
      }

      if (movimiento.tipoOperacion === "egreso" && movimiento.cuentaOrigenCajaBancoId === selectedCuentaId) {
        lines.push({
          id: `mov-egreso-${movimiento.id}`,
          fecha,
          fechaIso: fecha.toISOString(),
          origen: "movimiento",
          descripcion: movimiento.descripcion || "Egreso de tesoreria",
          referencia: movimiento.referencia || "",
          documento: movimiento.asientoId || movimiento.id,
          ingreso: 0,
          egreso: Number(movimiento.monto) || 0,
        });
      }

      if (movimiento.tipoOperacion === "traspaso") {
        if (movimiento.cuentaOrigenCajaBancoId === selectedCuentaId) {
          lines.push({
            id: `mov-traspaso-out-${movimiento.id}`,
            fecha,
            fechaIso: fecha.toISOString(),
            origen: "movimiento",
            descripcion: movimiento.descripcion || "Traspaso de salida",
            referencia: movimiento.referencia || "",
            documento: movimiento.asientoId || movimiento.id,
            ingreso: 0,
            egreso: Number(movimiento.monto) || 0,
          });
        }
        if (movimiento.cuentaDestinoCajaBancoId === selectedCuentaId) {
          lines.push({
            id: `mov-traspaso-in-${movimiento.id}`,
            fecha,
            fechaIso: fecha.toISOString(),
            origen: "movimiento",
            descripcion: movimiento.descripcion || "Traspaso de entrada",
            referencia: movimiento.referencia || "",
            documento: movimiento.asientoId || movimiento.id,
            ingreso: Number(movimiento.monto) || 0,
            egreso: 0,
          });
        }
      }
    }

    for (const cobro of cobrosCxc || []) {
      if (cobro.cuentaCajaBancoId !== selectedCuentaId) continue;
      const fecha = toDateSafe(cobro.fecha);
      if (!fecha) continue;
      const clienteNombre = clientesById.get(cobro.clienteId) || cobro.clienteId;
      lines.push({
        id: `cobro-${cobro.id}`,
        fecha,
        fechaIso: fecha.toISOString(),
        origen: "cobro",
        descripcion: `Cobro cliente ${clienteNombre}`,
        referencia: cobro.referencia || "",
        documento: cobro.reciboId || cobro.ventaId,
        ingreso: Number(cobro.monto) || 0,
        egreso: 0,
      });
    }

    for (const pago of pagosCxp || []) {
      if (pago.cuentaCajaBancoId !== selectedCuentaId) continue;
      const fecha = toDateSafe(pago.fecha);
      if (!fecha) continue;
      const proveedorNombre = proveedoresById.get(pago.proveedorId) || pago.proveedorId;
      lines.push({
        id: `pago-${pago.id}`,
        fecha,
        fechaIso: fecha.toISOString(),
        origen: "pago",
        descripcion: `Pago proveedor ${proveedorNombre}`,
        referencia: pago.referencia || "",
        documento: pago.compraId,
        ingreso: 0,
        egreso: Number(pago.monto) || 0,
      });
    }

    return lines.sort((a, b) => {
      if (a.fecha.getTime() !== b.fecha.getTime()) return a.fecha.getTime() - b.fecha.getTime();
      return a.id.localeCompare(b.id);
    });
  }, [clientesById, cobrosCxc, movimientosTesoreria, pagosCxp, proveedoresById, selectedCuentaId]);

  const extract = useMemo(() => {
    const linesBefore = allLines.filter((line) => (desdeDate ? line.fecha < desdeDate : true));
    const openingBalance = linesBefore.reduce((sum, line) => sum + toSignedBalance(line), 0);

    const periodLines = allLines.filter((line) => {
      if (desdeDate && line.fecha < desdeDate) return false;
      if (hastaDate && line.fecha > hastaDate) return false;
      return true;
    });

    let runningBalance = openingBalance;
    const rows = periodLines.map((line) => {
      runningBalance += toSignedBalance(line);
      return {
        ...line,
        saldo: runningBalance,
      };
    });

    const totalIngresos = rows.reduce((sum, line) => sum + line.ingreso, 0);
    const totalEgresos = rows.reduce((sum, line) => sum + line.egreso, 0);
    const closingBalance = openingBalance + totalIngresos - totalEgresos;

    return {
      openingBalance,
      rows,
      totalIngresos,
      totalEgresos,
      closingBalance,
    };
  }, [allLines, desdeDate, hastaDate]);

  const isLoading = l1 || l2 || l3 || l4 || l5;
  const reportSummary = selectedCuenta
    ? `Cuenta: ${selectedCuenta.nombre} | Desde ${format(desdeDate || new Date(), "dd/MM/yyyy")} hasta ${format(hastaDate || new Date(), "dd/MM/yyyy")} | Ingresos: ${selectedCuenta.moneda || ""} ${formatCurrency(extract.totalIngresos)} | Egresos: ${selectedCuenta.moneda || ""} ${formatCurrency(extract.totalEgresos)} | Saldo final: ${selectedCuenta.moneda || ""} ${formatCurrency(extract.closingBalance)}.`
    : "Extracto de caja y banco.";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle>Extracto de Caja / Banco</CardTitle>
          <CardDescription>
            Ficha de movimientos por cuenta financiera con saldo inicial, ingresos, egresos y saldo acumulado.
          </CardDescription>
        </div>
        <ReportActions
          reportTitle="Extracto de Caja / Banco"
          reportSummary={reportSummary}
          printTargetId="cash-bank-extract-report"
          documentLabel="Extracto de Caja/Banco"
          showDefaultFooter={false}
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Caja / Banco</label>
            <Select value={selectedCuentaId} onValueChange={setSelectedCuentaId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cuentasFinancieras.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={cuenta.id}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha inicio</label>
            <Input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha final</label>
            <Input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Badge variant="outline" className="h-10 w-full justify-center">
              Origen consolidado: Tesoreria + Cobros + Pagos
            </Badge>
          </div>
        </div>

        <div id="cash-bank-extract-report" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cuenta seleccionada</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-semibold">{selectedCuenta?.nombre || "Sin cuenta"}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCuenta ? `${selectedCuenta.tipo} | ${selectedCuenta.moneda || "Moneda no definida"}` : "Seleccione una cuenta financiera"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Saldo inicial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {selectedCuenta?.moneda || ""} {formatCurrency(extract.openingBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Balance acumulado anterior a {desdeDate ? format(desdeDate, "dd/MM/yyyy") : "-"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                  Ingresos del periodo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {selectedCuenta?.moneda || ""} {formatCurrency(extract.totalIngresos)}
                </p>
                <p className="text-xs text-muted-foreground">{extract.rows.filter((row) => row.ingreso > 0).length} movimientos de ingreso</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ArrowUpToLine className="h-4 w-4 text-muted-foreground" />
                  Egresos del periodo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {selectedCuenta?.moneda || ""} {formatCurrency(extract.totalEgresos)}
                </p>
                <p className="text-xs text-muted-foreground">{extract.rows.filter((row) => row.egreso > 0).length} movimientos de egreso</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ficha de movimientos</CardTitle>
              <CardDescription>
                {selectedCuenta
                  ? `${selectedCuenta.nombre} | Desde ${format(desdeDate || new Date(), "dd/MM/yyyy")} hasta ${format(hastaDate || new Date(), "dd/MM/yyyy")}`
                  : "Seleccione una cuenta financiera"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="font-medium text-muted-foreground">Generado por</p>
                  <p>{user?.displayName || user?.email || "Usuario actual"}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Fecha de emision</p>
                  <p>{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Cuenta contable</p>
                  <p>{selectedCuenta ? `${selectedCuenta.cuentaContableCodigo} - ${selectedCuenta.cuentaContableNombre}` : "-"}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Soporte</p>
                  <p>Movimientos tesoreria, cobros CxC y pagos CxP</p>
                </div>
              </div>

              <Table resizable className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Ingreso</TableHead>
                    <TableHead className="text-right">Egreso</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="font-medium">
                      Saldo inicial
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {selectedCuenta?.moneda || ""} {formatCurrency(extract.openingBalance)}
                    </TableCell>
                  </TableRow>

                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Cargando extracto...
                      </TableCell>
                    </TableRow>
                  ) : extract.rows.length > 0 ? (
                    extract.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{format(row.fecha, "dd/MM/yyyy")}</TableCell>
                        <TableCell className="max-w-[360px] whitespace-normal">
                          <div className="flex items-start gap-2">
                            {row.origen === "cobro" ? (
                              <Wallet className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            ) : row.origen === "pago" ? (
                              <Landmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Receipt className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{row.descripcion}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.referencia || "-"}</TableCell>
                        <TableCell>{row.documento || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.ingreso > 0 ? `${selectedCuenta?.moneda || ""} ${formatCurrency(row.ingreso)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.egreso > 0 ? `${selectedCuenta?.moneda || ""} ${formatCurrency(row.egreso)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {selectedCuenta?.moneda || ""} {formatCurrency(row.saldo)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No hay movimientos para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  )}

                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={4}>Totales del periodo</TableCell>
                    <TableCell className="text-right font-mono">
                      {selectedCuenta?.moneda || ""} {formatCurrency(extract.totalIngresos)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {selectedCuenta?.moneda || ""} {formatCurrency(extract.totalEgresos)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {selectedCuenta?.moneda || ""} {formatCurrency(extract.closingBalance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Solo se incluyen cobros y pagos que ya tengan `cuentaCajaBancoId` asociado. Si hay registros historicos sin esa vinculacion, no apareceran en este extracto.
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

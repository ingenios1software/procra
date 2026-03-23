"use client";

import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Landmark, Percent, Scale, TriangleAlert } from "lucide-react";
import { useCollection, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AsientoDiario, CompraNormal, Insumo, PlanDeCuenta, Venta, Zafra } from "@/lib/types";
import {
  PARAGUAY_ZAFRA_ALL,
  buildSerieMensualIre,
  buildSerieMensualIva,
  calcularIreEstimado,
  calcularIvaPorMoneda,
  getEjerciciosIreDisponibles,
  getEjerciciosIvaDisponibles,
  getMesLabelLargo,
  getMesesIvaDisponibles,
  getMonedasIvaDisponibles,
  getUltimoEjercicioIre,
  getUltimoPeriodoIva,
  type MonedaTributaria,
  type ResumenIvaMoneda,
} from "@/lib/impuestos-paraguay";
import { formatCurrency } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

function formatSignedCurrency(moneda: MonedaTributaria, value: number): string {
  const sign = value > 0 ? "" : value < 0 ? "-" : "";
  return `${moneda} ${sign}${formatCurrency(Math.abs(value))}`;
}

function getIvaStatusLabel(summary: ResumenIvaMoneda): string {
  if (summary.estado === "a_pagar") return "A pagar";
  if (summary.estado === "saldo_a_favor") return "Saldo a favor";
  return "Sin diferencia";
}

export default function ImpuestosPage() {
  const tenant = useTenantFirestore();
  const [selectedZafraId, setSelectedZafraId] = useState<string>(PARAGUAY_ZAFRA_ALL);
  const [selectedIvaYear, setSelectedIvaYear] = useState<string>("");
  const [selectedIvaMonth, setSelectedIvaMonth] = useState<string>("");
  const [selectedIvaCurrency, setSelectedIvaCurrency] = useState<string>("");
  const [selectedIreYear, setSelectedIreYear] = useState<string>("");

  const { data: ventas, isLoading: l1 } = useCollection<Venta>(
    useMemoFirebase(() => tenant.query("ventas", orderBy("fecha", "desc")), [tenant])
  );
  const { data: compras, isLoading: l2 } = useCollection<CompraNormal>(
    useMemoFirebase(() => tenant.query("comprasNormal", orderBy("fechaEmision", "desc")), [tenant])
  );
  const { data: insumos, isLoading: l3 } = useCollection<Insumo>(
    useMemoFirebase(() => tenant.query("insumos", orderBy("nombre")), [tenant])
  );
  const { data: asientos, isLoading: l4 } = useCollection<AsientoDiario>(
    useMemoFirebase(() => tenant.query("asientosDiario", orderBy("fecha", "desc")), [tenant])
  );
  const { data: planDeCuentas, isLoading: l5 } = useCollection<PlanDeCuenta>(
    useMemoFirebase(() => tenant.query("planDeCuentas", orderBy("codigo")), [tenant])
  );
  const { data: zafras, isLoading: l6 } = useCollection<Zafra>(
    useMemoFirebase(() => tenant.query("zafras", orderBy("nombre")), [tenant])
  );

  const latestVatPeriod = useMemo(
    () => getUltimoPeriodoIva(ventas, compras, selectedZafraId),
    [compras, selectedZafraId, ventas]
  );
  const latestIreYear = useMemo(
    () => getUltimoEjercicioIre(asientos, selectedZafraId),
    [asientos, selectedZafraId]
  );

  const ivaYears = useMemo(
    () => getEjerciciosIvaDisponibles(ventas, compras, selectedZafraId),
    [compras, selectedZafraId, ventas]
  );
  const effectiveIvaYear = useMemo(() => {
    const requested = Number(selectedIvaYear);
    if (Number.isFinite(requested) && ivaYears.includes(requested)) return requested;
    if (latestVatPeriod?.ejercicio) return latestVatPeriod.ejercicio;
    if (ivaYears.length > 0) return ivaYears[ivaYears.length - 1];
    return new Date().getFullYear();
  }, [ivaYears, latestVatPeriod, selectedIvaYear]);

  const ivaMonths = useMemo(
    () => getMesesIvaDisponibles(ventas, compras, effectiveIvaYear, selectedZafraId),
    [compras, effectiveIvaYear, selectedZafraId, ventas]
  );
  const effectiveIvaMonth = useMemo(() => {
    const requested = Number(selectedIvaMonth);
    if (Number.isFinite(requested) && ivaMonths.includes(requested)) return requested;
    if (latestVatPeriod?.ejercicio === effectiveIvaYear) return latestVatPeriod.mes;
    if (ivaMonths.length > 0) return ivaMonths[ivaMonths.length - 1];
    return new Date().getMonth() + 1;
  }, [effectiveIvaYear, ivaMonths, latestVatPeriod, selectedIvaMonth]);

  const ivaCurrencies = useMemo(
    () => getMonedasIvaDisponibles(ventas, compras, effectiveIvaYear, effectiveIvaMonth, selectedZafraId),
    [compras, effectiveIvaMonth, effectiveIvaYear, selectedZafraId, ventas]
  );
  const effectiveIvaCurrency = useMemo<MonedaTributaria>(() => {
    if (selectedIvaCurrency === "PYG" || selectedIvaCurrency === "USD") {
      if (ivaCurrencies.includes(selectedIvaCurrency)) return selectedIvaCurrency;
    }
    if (ivaCurrencies.includes("PYG")) return "PYG";
    if (ivaCurrencies.includes("USD")) return "USD";
    return "PYG";
  }, [ivaCurrencies, selectedIvaCurrency]);

  const ireYears = useMemo(
    () => getEjerciciosIreDisponibles(asientos, selectedZafraId),
    [asientos, selectedZafraId]
  );
  const effectiveIreYear = useMemo(() => {
    const requested = Number(selectedIreYear);
    if (Number.isFinite(requested) && ireYears.includes(requested)) return requested;
    if (latestIreYear) return latestIreYear;
    if (ireYears.length > 0) return ireYears[ireYears.length - 1];
    return new Date().getFullYear();
  }, [ireYears, latestIreYear, selectedIreYear]);

  const vatByCurrency = useMemo(
    () =>
      calcularIvaPorMoneda({
        ventas,
        compras,
        insumos,
        ejercicio: effectiveIvaYear,
        mes: effectiveIvaMonth,
        selectedZafraId,
      }),
    [compras, effectiveIvaMonth, effectiveIvaYear, insumos, selectedZafraId, ventas]
  );

  const vatSummary = vatByCurrency[effectiveIvaCurrency];
  const vatSeries = useMemo(
    () =>
      buildSerieMensualIva({
        ventas,
        compras,
        insumos,
        ejercicio: effectiveIvaYear,
        moneda: effectiveIvaCurrency,
        selectedZafraId,
      }),
    [compras, effectiveIvaCurrency, effectiveIvaYear, insumos, selectedZafraId, ventas]
  );

  const ireSummary = useMemo(
    () =>
      calcularIreEstimado({
        asientos,
        planDeCuentas,
        ventas,
        compras,
        ejercicio: effectiveIreYear,
        selectedZafraId,
      }),
    [asientos, compras, effectiveIreYear, planDeCuentas, selectedZafraId, ventas]
  );
  const ireSeries = useMemo(
    () =>
      buildSerieMensualIre({
        asientos,
        planDeCuentas,
        ejercicio: effectiveIreYear,
        selectedZafraId,
      }).map((item) => ({
        ...item,
        egresos: item.costosDeducibles + item.gastosDeducibles,
      })),
    [asientos, effectiveIreYear, planDeCuentas, selectedZafraId]
  );

  const selectedZafraLabel = useMemo(() => {
    if (selectedZafraId === PARAGUAY_ZAFRA_ALL) return "Consolidado";
    return zafras?.find((zafra) => zafra.id === selectedZafraId)?.nombre || "Zafra no encontrada";
  }, [selectedZafraId, zafras]);

  const shareSummary = `IVA ${getMesLabelLargo(effectiveIvaMonth)} ${effectiveIvaYear} ${effectiveIvaCurrency}: ${formatSignedCurrency(
    effectiveIvaCurrency,
    vatSummary.saldoIva
  )} | IRE ${effectiveIreYear}: ${formatCurrency(ireSummary.ireEstimado)}.`;

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;
  if (isLoading) return <p>Cargando simulador de impuestos...</p>;

  const ivaRows = [vatSummary.ventas.buckets["10"], vatSummary.ventas.buckets["5"], vatSummary.ventas.buckets["0"], vatSummary.ventas.buckets.sin_clasificar];
  const comprasRows = [vatSummary.compras.buckets["10"], vatSummary.compras.buckets["5"], vatSummary.compras.buckets["0"], vatSummary.compras.buckets.sin_clasificar];

  return (
    <>
      <PageHeader
        title="Simulador de Impuestos"
        description="Simulacion tributaria para Paraguay basada en datos de Firestore: IVA mensual e IRE anual."
      >
        <ReportActions reportTitle="Simulador de Impuestos" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros del simulador</CardTitle>
            <CardDescription>Seleccione zafra, periodo mensual para IVA y ejercicio anual para IRE.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Zafra</p>
              <Select value={selectedZafraId} onValueChange={setSelectedZafraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una zafra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PARAGUAY_ZAFRA_ALL}>Consolidado</SelectItem>
                  {(zafras || []).map((zafra) => (
                    <SelectItem key={zafra.id} value={zafra.id}>
                      {zafra.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Ejercicio IVA</p>
              <Select value={String(effectiveIvaYear)} onValueChange={setSelectedIvaYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ivaYears.length > 0 ? (
                    ivaYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(effectiveIvaYear)}>{effectiveIvaYear}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Mes IVA</p>
              <Select value={String(effectiveIvaMonth)} onValueChange={setSelectedIvaMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ivaMonths.length > 0 ? (
                    ivaMonths.map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        {getMesLabelLargo(month)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(effectiveIvaMonth)}>{getMesLabelLargo(effectiveIvaMonth)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Moneda IVA</p>
              <Select value={effectiveIvaCurrency} onValueChange={setSelectedIvaCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ivaCurrencies.length > 0 ? (
                    ivaCurrencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={effectiveIvaCurrency}>{effectiveIvaCurrency}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Ejercicio IRE</p>
              <Select value={String(effectiveIreYear)} onValueChange={setSelectedIreYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ireYears.length > 0 ? (
                    ireYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(effectiveIreYear)}>{effectiveIreYear}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 text-xs md:col-span-2 xl:col-span-5">
              <Badge variant="secondary">Contexto: {selectedZafraLabel}</Badge>
              <Badge variant="outline">
                IVA: {getMesLabelLargo(effectiveIvaMonth)} {effectiveIvaYear} ({effectiveIvaCurrency})
              </Badge>
              <Badge variant="outline">IRE: Ejercicio {effectiveIreYear}</Badge>
              {ivaCurrencies.length > 1 ? <Badge variant="outline">IVA con multimoneda en el periodo</Badge> : null}
              {ireSummary.multimonedaDetectada ? (
                <Badge variant="destructive">IRE con mezcla de monedas comerciales</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Base Ventas IVA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.ventas.baseImponible)}</p>
              <p className="text-xs text-muted-foreground">Base imponible clasificada de ventas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Debito Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.debitoFiscal)}</p>
              <p className="text-xs text-muted-foreground">IVA de ventas del mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Credito Fiscal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.creditoFiscal)}</p>
              <p className="text-xs text-muted-foreground">IVA de compras clasificadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">IVA Neto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.saldoIva)}</p>
              <p className="text-xs text-muted-foreground">{getIvaStatusLabel(vatSummary)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Scale className="h-4 w-4 text-muted-foreground" />
                Resultado Contable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(ireSummary.resultadoContable)}</p>
              <p className="text-xs text-muted-foreground">Ingresos menos costos y gastos del ejercicio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                IRE Estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(ireSummary.ireEstimado)}</p>
              <p className="text-xs text-muted-foreground">Tasa general 10% sobre base positiva</p>
            </CardContent>
          </Card>
        </div>

        {(vatSummary.ventas.montoSinClasificar > 0 ||
          vatSummary.compras.montoSinClasificar > 0 ||
          ireSummary.multimonedaDetectada ||
          ireSummary.movimientosSinCuenta > 0) && (
          <Card className="border-amber-300/60 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <TriangleAlert className="h-4 w-4" />
                Alertas de simulacion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-950">
              {vatSummary.ventas.montoSinClasificar > 0 || vatSummary.compras.montoSinClasificar > 0 ? (
                <p>
                  Existen montos sin clasificar por alicuota. Revise insumos sin IVA configurado y fletes sin tasa
                  fiscal explicitada.
                </p>
              ) : null}
              {ireSummary.multimonedaDetectada ? (
                <p>
                  El IRE se calcula con el resultado contable actual. Si la empresa mezcla USD y PYG, el valor es
                  referencial y debe revisarse contra la moneda contable/base del tenant.
                </p>
              ) : null}
              {ireSummary.movimientosSinCuenta > 0 ? (
                <p>
                  Hay movimientos contables sin cuenta resoluble en el plan de cuentas: {ireSummary.movimientosSinCuenta}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Serie mensual de IVA</CardTitle>
              <CardDescription>
                Debito, credito y saldo mensual para {effectiveIvaCurrency} en {effectiveIvaYear}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={vatSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatSignedCurrency(effectiveIvaCurrency, Number(value))}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                  />
                  <Legend />
                  <Bar dataKey="debitoFiscal" name="Debito" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="creditoFiscal" name="Credito" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  <Line dataKey="saldoIva" name="Saldo" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Serie mensual de IRE</CardTitle>
              <CardDescription>
                Evolucion del resultado contable del ejercicio {effectiveIreYear}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={ireSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                  />
                  <Legend />
                  <Bar dataKey="ingresosNetos" name="Ingresos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="egresos" name="Costos + Gastos" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  <Line dataKey="resultadoContable" name="Resultado" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Detalle IVA de Ventas</CardTitle>
              <CardDescription>
                Reconstruccion del debito fiscal desde `ventas` + `insumos` para {effectiveIvaCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alicuota</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Lineas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ivaRows.map((row) => (
                    <TableRow key={`venta-${row.key}`}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.montoBruto)}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.baseImponible)}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.impuesto)}</TableCell>
                      <TableCell className="text-right">{row.lineas}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total ventas</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.ventas.montoBruto)}</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.ventas.baseImponible)}</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.ventas.impuesto)}</TableCell>
                    <TableCell className="text-right">{vatSummary.ventas.lineas}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle IVA de Compras</CardTitle>
              <CardDescription>
                Reconstruccion del credito fiscal desde `comprasNormal` + `insumos` para {effectiveIvaCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alicuota</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Lineas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprasRows.map((row) => (
                    <TableRow key={`compra-${row.key}`}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.montoBruto)}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.baseImponible)}</TableCell>
                      <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, row.impuesto)}</TableCell>
                      <TableCell className="text-right">{row.lineas}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total compras</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.compras.montoBruto)}</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.compras.baseImponible)}</TableCell>
                    <TableCell className="text-right">{formatSignedCurrency(effectiveIvaCurrency, vatSummary.compras.impuesto)}</TableCell>
                    <TableCell className="text-right">{vatSummary.compras.lineas}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas de Ingreso</CardTitle>
              <CardDescription>Principales cuentas que forman la base del IRE.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ireSummary.cuentasIngresos.slice(0, 6).map((row) => (
                    <TableRow key={row.cuentaId}>
                      <TableCell>{row.codigo} - {row.nombre}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.saldo)}</TableCell>
                    </TableRow>
                  ))}
                  {ireSummary.cuentasIngresos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                        Sin cuentas de ingreso para este ejercicio.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cuentas de Costo</CardTitle>
              <CardDescription>Costos reconocidos contablemente en el ejercicio.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ireSummary.cuentasCostos.slice(0, 6).map((row) => (
                    <TableRow key={row.cuentaId}>
                      <TableCell>{row.codigo} - {row.nombre}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.saldo)}</TableCell>
                    </TableRow>
                  ))}
                  {ireSummary.cuentasCostos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                        Sin cuentas de costo para este ejercicio.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cuentas de Gasto</CardTitle>
              <CardDescription>Gastos operativos considerados en la simulacion.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ireSummary.cuentasGastos.slice(0, 6).map((row) => (
                    <TableRow key={row.cuentaId}>
                      <TableCell>{row.codigo} - {row.nombre}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.saldo)}</TableCell>
                    </TableRow>
                  ))}
                  {ireSummary.cuentasGastos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                        Sin cuentas de gasto para este ejercicio.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supuestos fiscales del modulo</CardTitle>
            <CardDescription>Notas para interpretar correctamente la simulacion antes de usarla como referencia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>IVA: se calcula mensualmente como debito fiscal menos credito fiscal, usando alicuotas 10%, 5% y exenta reconstruidas desde documentos comerciales.</p>
            <p>IRE: se estima al 10% sobre la base positiva del resultado contable anual de cuentas de ingreso, costo y gasto del libro diario.</p>
            <p>Los fletes o lineas sin alicuota identificable quedan marcados como &quot;Sin clasificar&quot; y no se toman como credito fiscal hasta que tengan soporte.</p>
            <p>Si hay operaciones en USD y PYG, revise la moneda base del tenant y la consistencia de asientos antes de considerar el IRE como valor util para decision fiscal.</p>
            <p>Esta pantalla es una simulacion de control de gestion. No reemplaza la liquidacion formal ni la revision profesional previa a la presentacion ante DNIT.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

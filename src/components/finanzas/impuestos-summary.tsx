"use client";

import Link from "next/link";
import { useMemo } from "react";
import { orderBy } from "firebase/firestore";
import { Landmark, Percent } from "lucide-react";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AsientoDiario, CompraNormal, Insumo, PlanDeCuenta, Venta } from "@/lib/types";
import {
  calcularIreEstimado,
  calcularIvaPorMoneda,
  getMesLabelCorto,
  getUltimoEjercicioIre,
  getUltimoPeriodoIva,
  type MonedaTributaria,
  type ResumenIvaMoneda,
} from "@/lib/impuestos-paraguay";
import { cn, formatCurrency } from "@/lib/utils";

type ImpuestosSummaryProps = {
  className?: string;
};

function formatSignedCurrency(moneda: MonedaTributaria, value: number): string {
  const sign = value > 0 ? "" : value < 0 ? "-" : "";
  return `${moneda} ${sign}${formatCurrency(Math.abs(value))}`;
}

function getIvaStatusLabel(summary: ResumenIvaMoneda): string {
  if (summary.estado === "a_pagar") return "A pagar";
  if (summary.estado === "saldo_a_favor") return "Saldo a favor";
  return "Sin diferencia";
}

export function ImpuestosSummary({ className }: ImpuestosSummaryProps) {
  const tenant = useTenantFirestore();

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

  const latestVatPeriod = useMemo(() => getUltimoPeriodoIva(ventas, compras), [ventas, compras]);
  const latestVatByCurrency = useMemo(() => {
    if (!latestVatPeriod) return [];

    const allCurrencies = calcularIvaPorMoneda({
      ventas,
      compras,
      insumos,
      ejercicio: latestVatPeriod.ejercicio,
      mes: latestVatPeriod.mes,
    });

    return (Object.values(allCurrencies) as ResumenIvaMoneda[]).filter(
      (item) => item.ventas.documentos > 0 || item.compras.documentos > 0
    );
  }, [compras, insumos, latestVatPeriod, ventas]);

  const latestIreYear = useMemo(() => getUltimoEjercicioIre(asientos), [asientos]);
  const ireSummary = useMemo(() => {
    if (!latestIreYear) return null;
    return calcularIreEstimado({
      asientos,
      planDeCuentas,
      ventas,
      compras,
      ejercicio: latestIreYear,
    });
  }, [asientos, compras, latestIreYear, planDeCuentas, ventas]);

  const isLoading = l1 || l2 || l3 || l4 || l5;
  const ivaPeriodLabel = latestVatPeriod
    ? `${getMesLabelCorto(latestVatPeriod.mes)} ${latestVatPeriod.ejercicio}`
    : "Sin periodo";

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Simulacion Tributaria Paraguay
          </CardTitle>
          <CardDescription>
            IVA del ultimo mes con documentos e IRE estimado del ultimo ejercicio con asientos.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/finanzas/impuestos">Abrir simulador completo</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Preparando resumen tributario...</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">IVA: {ivaPeriodLabel}</Badge>
              <Badge variant="outline">IRE: {latestIreYear || "Sin ejercicio"}</Badge>
              {ireSummary?.multimonedaDetectada ? (
                <Badge variant="destructive">IRE con multimoneda detectada</Badge>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {latestVatByCurrency.length > 0 ? (
                latestVatByCurrency.map((summary) => (
                  <Card key={summary.moneda} className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">IVA Neto {summary.moneda}</CardTitle>
                      <CardDescription>{ivaPeriodLabel}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">
                        {formatSignedCurrency(summary.moneda, summary.saldoIva)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getIvaStatusLabel(summary)} | Debito: {formatSignedCurrency(summary.moneda, summary.debitoFiscal)}
                      </p>
                      {summary.compras.montoSinClasificar > 0 || summary.ventas.montoSinClasificar > 0 ? (
                        <p className="mt-2 text-xs text-amber-700">
                          Hay montos pendientes de clasificacion por alicuota.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed md:col-span-2">
                  <CardContent className="flex min-h-28 items-center">
                    <p className="text-sm text-muted-foreground">
                      No hay compras o ventas suficientes para simular IVA.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    IRE Estimado
                  </CardTitle>
                  <CardDescription>{latestIreYear || "Sin ejercicio"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {ireSummary ? formatCurrency(ireSummary.ireEstimado) : "0,00"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Base imponible: {ireSummary ? formatCurrency(ireSummary.baseImponible) : "0,00"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Regimen general al 10% sobre resultado contable positivo.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Resultado Contable</CardTitle>
                  <CardDescription>{latestIreYear || "Sin ejercicio"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {ireSummary ? formatCurrency(ireSummary.resultadoContable) : "0,00"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ingresos: {ireSummary ? formatCurrency(ireSummary.ingresosNetos) : "0,00"}
                  </p>
                  {ireSummary?.multimonedaDetectada ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Revise moneda base y asientos antes de usar este valor como referencia fiscal.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

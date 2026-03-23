"use client";

import Link from "next/link";
import { useMemo } from "react";
import { orderBy } from "firebase/firestore";
import { Boxes, Landmark, TriangleAlert, Wallet } from "lucide-react";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CuentaPorCobrar, CuentaPorPagar, Insumo, Moneda } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type ExecutiveAlertsProps = {
  className?: string;
};

type CurrencySummary = {
  USD: number;
  PYG: number;
};

function summarizeByCurrency(rows: Array<{ moneda: "USD" | "PYG"; saldoPendiente: number }>): CurrencySummary {
  return rows.reduce<CurrencySummary>(
    (summary, row) => {
      summary[row.moneda] += Number(row.saldoPendiente || 0);
      return summary;
    },
    { USD: 0, PYG: 0 }
  );
}

function formatCurrencyBreakdown(summary: CurrencySummary): string {
  const chunks = [
    summary.USD > 0 ? `USD ${formatCurrency(summary.USD)}` : null,
    summary.PYG > 0 ? `PYG ${formatCurrency(summary.PYG)}` : null,
  ].filter(Boolean);

  return chunks.length > 0 ? chunks.join(" | ") : "Sin saldo vencido";
}

export function ExecutiveAlerts({ className }: ExecutiveAlertsProps) {
  const tenant = useTenantFirestore();

  const { data: cuentasPorCobrar, isLoading: l1 } = useCollection<CuentaPorCobrar>(
    useMemoFirebase(() => tenant.query("cuentasPorCobrar", orderBy("fechaEmision", "desc")), [tenant])
  );
  const { data: cuentasPorPagar, isLoading: l2 } = useCollection<CuentaPorPagar>(
    useMemoFirebase(() => tenant.query("cuentasPorPagar", orderBy("fechaEmision", "desc")), [tenant])
  );
  const { data: insumos, isLoading: l3 } = useCollection<Insumo>(
    useMemoFirebase(() => tenant.query("insumos", orderBy("nombre")), [tenant])
  );
  const { data: monedas, isLoading: l4 } = useCollection<Moneda>(
    useMemoFirebase(() => tenant.query("monedas", orderBy("codigo")), [tenant])
  );

  const {
    overdueReceivables,
    overduePayables,
    overdueReceivablesByCurrency,
    overduePayablesByCurrency,
    lowStockItems,
    baseCurrencies,
  } = useMemo(() => {
    const overdueReceivables = (cuentasPorCobrar || []).filter(
      (cuenta) => cuenta.estado === "vencida" && Number(cuenta.saldoPendiente || 0) > 0.005
    );
    const overduePayables = (cuentasPorPagar || []).filter(
      (cuenta) => cuenta.estado === "vencida" && Number(cuenta.saldoPendiente || 0) > 0.005
    );
    const overdueReceivablesByCurrency = summarizeByCurrency(
      overdueReceivables.map((cuenta) => ({
        moneda: cuenta.moneda,
        saldoPendiente: Number(cuenta.saldoPendiente || 0),
      }))
    );
    const overduePayablesByCurrency = summarizeByCurrency(
      overduePayables.map((cuenta) => ({
        moneda: cuenta.moneda,
        saldoPendiente: Number(cuenta.saldoPendiente || 0),
      }))
    );
    const lowStockItems = (insumos || []).filter((insumo) => {
      const minimo = Number(insumo.stockMinimo || 0);
      const actual = Number(insumo.stockActual || 0);
      return minimo > 0 && actual < minimo;
    });
    const baseCurrencies = (monedas || []).filter((moneda) => moneda.esMonedaBase);

    return {
      overdueReceivables,
      overduePayables,
      overdueReceivablesByCurrency,
      overduePayablesByCurrency,
      lowStockItems,
      baseCurrencies,
    };
  }, [cuentasPorCobrar, cuentasPorPagar, insumos, monedas]);

  const isLoading = l1 || l2 || l3 || l4;
  const hasCriticalAlerts =
    overdueReceivables.length > 0 ||
    overduePayables.length > 0 ||
    lowStockItems.length > 0 ||
    baseCurrencies.length !== 1;

  const topLowStockNames = lowStockItems
    .slice(0, 3)
    .map((item) => item.nombre)
    .join(", ");

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-muted-foreground" />
            Alertas Ejecutivas
          </CardTitle>
          <CardDescription>
            Lectura rapida de vencimientos, stock critico y configuracion monetaria del tenant.
          </CardDescription>
        </div>
        {hasCriticalAlerts ? <Badge variant="destructive">Requiere atencion</Badge> : <Badge variant="secondary">Sin alertas criticas</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando alertas ejecutivas...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Cobros Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-semibold">{overdueReceivables.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrencyBreakdown(overdueReceivablesByCurrency)}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/finanzas/cuentas-cobrar">Ver CxC</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  Pagos Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-semibold">{overduePayables.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrencyBreakdown(overduePayablesByCurrency)}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/finanzas/cuentas-pagar">Ver CxP</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  Stock Critico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-semibold">{lowStockItems.length}</p>
                <p className="text-xs text-muted-foreground">
                  {lowStockItems.length > 0
                    ? `Items bajo minimo: ${topLowStockNames}${lowStockItems.length > 3 ? "..." : ""}`
                    : "No hay insumos por debajo del minimo."}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/stock">Ver Stock</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Moneda Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-semibold">
                  {baseCurrencies.length === 1 ? baseCurrencies[0].codigo : baseCurrencies.length === 0 ? "Falta" : "Duplicada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {baseCurrencies.length === 1
                    ? `Configurada: ${baseCurrencies[0].codigo} - ${baseCurrencies[0].descripcion}`
                    : baseCurrencies.length === 0
                      ? "No hay moneda base definida."
                      : `Hay ${baseCurrencies.length} monedas marcadas como base.`}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/maestros/monedas">Ver Monedas</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

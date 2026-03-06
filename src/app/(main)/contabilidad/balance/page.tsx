"use client";

import { useMemo, useState } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { AsientoDiario, PlanDeCuenta, Zafra } from "@/lib/types";
import {
  getSaldoSegunNaturaleza,
  matchesAsientoZafraFilter,
  ZAFRA_FILTER_ALL,
  ZAFRA_FILTER_NONE,
} from "@/lib/contabilidad/asientos";

type BalanceRow = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: PlanDeCuenta["tipo"];
  naturaleza: PlanDeCuenta["naturaleza"];
  totalDebe: number;
  totalHaber: number;
  saldo: number;
};

const BALANCE_TOLERANCE = 0.005;

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sumRows(rows: BalanceRow[]): number {
  return roundMoney(rows.reduce((acc, row) => acc + row.saldo, 0));
}

function renderSection(title: string, description: string, rows: BalanceRow[], total: number) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codigo</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Haber</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.cuentaId}>
                  <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell className="text-right font-mono">${formatCurrency(row.totalDebe)}</TableCell>
                  <TableCell className="text-right font-mono">${formatCurrency(row.totalHaber)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${formatCurrency(row.saldo)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  Sin movimientos para esta seccion.
                </TableCell>
              </TableRow>
            )}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell colSpan={4}>Total {title}</TableCell>
              <TableCell className="text-right font-mono">${formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BalancePage() {
  const firestore = useFirestore();
  const [selectedZafraId, setSelectedZafraId] = useState<string>(ZAFRA_FILTER_ALL);

  const asientosQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "asientosDiario"), orderBy("fecha", "desc")) : null),
    [firestore]
  );
  const { data: asientosDiario, isLoading: isLoadingAsientos } = useCollection<AsientoDiario>(asientosQuery);

  const planDeCuentasQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "planDeCuentas"), orderBy("codigo")) : null),
    [firestore]
  );
  const { data: planDeCuentas, isLoading: isLoadingCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const zafrasQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "zafras"), orderBy("nombre")) : null),
    [firestore]
  );
  const { data: zafras } = useCollection<Zafra>(zafrasQuery);

  const {
    asientosFiltrados,
    activos,
    pasivos,
    patrimonio,
    ingresos,
    costos,
    gastos,
    totalActivo,
    totalPasivo,
    totalPatrimonio,
    totalIngresos,
    totalCostos,
    totalGastos,
    resultado,
    derechaBalance,
    diferencia,
  } = useMemo(() => {
    const filteredAsientos = (asientosDiario || []).filter((asiento) =>
      matchesAsientoZafraFilter(asiento, selectedZafraId)
    );

    const accounts = (planDeCuentas || []).map<BalanceRow | null>((cuenta) => {
      const totals = filteredAsientos.reduce(
        (acc, asiento) => {
          for (const mov of asiento.movimientos) {
            if (mov.cuentaId !== cuenta.id) continue;
            if (mov.tipo === "debe") acc.totalDebe += Number(mov.monto) || 0;
            if (mov.tipo === "haber") acc.totalHaber += Number(mov.monto) || 0;
          }
          return acc;
        },
        { totalDebe: 0, totalHaber: 0 }
      );

      if (totals.totalDebe <= BALANCE_TOLERANCE && totals.totalHaber <= BALANCE_TOLERANCE) return null;

      return {
        cuentaId: cuenta.id,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        naturaleza: cuenta.naturaleza,
        totalDebe: roundMoney(totals.totalDebe),
        totalHaber: roundMoney(totals.totalHaber),
        saldo: roundMoney(getSaldoSegunNaturaleza(cuenta, totals.totalDebe, totals.totalHaber)),
      };
    }).filter((item): item is BalanceRow => Boolean(item));

    const activosRows = accounts.filter((row) => row.tipo === "activo");
    const pasivosRows = accounts.filter((row) => row.tipo === "pasivo");
    const patrimonioRows = accounts.filter((row) => row.tipo === "patrimonio");
    const ingresosRows = accounts.filter((row) => row.tipo === "ingreso");
    const costosRows = accounts.filter((row) => row.tipo === "costo");
    const gastosRows = accounts.filter((row) => row.tipo === "gasto");

    const activo = sumRows(activosRows);
    const pasivo = sumRows(pasivosRows);
    const patr = sumRows(patrimonioRows);
    const ingreso = sumRows(ingresosRows);
    const costo = sumRows(costosRows);
    const gasto = sumRows(gastosRows);
    const resultadoNeto = roundMoney(ingreso - costo - gasto);
    const derecha = roundMoney(pasivo + patr + resultadoNeto);
    const diferenciaBalance = roundMoney(activo - derecha);

    return {
      asientosFiltrados: filteredAsientos,
      activos: activosRows,
      pasivos: pasivosRows,
      patrimonio: patrimonioRows,
      ingresos: ingresosRows,
      costos: costosRows,
      gastos: gastosRows,
      totalActivo: activo,
      totalPasivo: pasivo,
      totalPatrimonio: patr,
      totalIngresos: ingreso,
      totalCostos: costo,
      totalGastos: gasto,
      resultado: resultadoNeto,
      derechaBalance: derecha,
      diferencia: diferenciaBalance,
    };
  }, [asientosDiario, planDeCuentas, selectedZafraId]);

  const zafraSeleccionadaLabel = useMemo(() => {
    if (selectedZafraId === ZAFRA_FILTER_ALL) return "Consolidado";
    if (selectedZafraId === ZAFRA_FILTER_NONE) return "Sin zafra";
    return zafras?.find((zafra) => zafra.id === selectedZafraId)?.nombre || "Zafra no encontrada";
  }, [selectedZafraId, zafras]);

  const asientosEtiquetados = useMemo(
    () => (asientosDiario || []).filter((asiento) => Boolean(asiento.zafraId)).length,
    [asientosDiario]
  );

  const balanceCuadrado = Math.abs(diferencia) <= 0.01;
  const shareSummary = `Contexto: ${zafraSeleccionadaLabel} | Activo: $${formatCurrency(totalActivo)} | Pasivo+Patrimonio+Resultado: $${formatCurrency(derechaBalance)} | Diferencia: $${formatCurrency(diferencia)}.`;
  const isLoading = isLoadingAsientos || isLoadingCuentas;

  return (
    <>
      <PageHeader
        title="Balance por Zafra"
        description="Consolida los asientos del libro diario para visualizar balance general por campana o en consolidado."
      >
        <ReportActions reportTitle="Balance por Zafra" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contexto del Balance</CardTitle>
            <CardDescription>Seleccione la zafra que desea analizar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
            <Select value={selectedZafraId} onValueChange={setSelectedZafraId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una zafra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ZAFRA_FILTER_ALL}>Consolidado</SelectItem>
                <SelectItem value={ZAFRA_FILTER_NONE}>Sin zafra</SelectItem>
                {(zafras || []).map((zafra) => (
                  <SelectItem key={zafra.id} value={zafra.id}>
                    {zafra.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">Contexto: {zafraSeleccionadaLabel}</Badge>
              <Badge variant="outline">Asientos filtrados: {asientosFiltrados.length}</Badge>
              <Badge variant="outline">Asientos con zafra: {asientosEtiquetados}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Activo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${formatCurrency(totalActivo)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pasivo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${formatCurrency(totalPasivo)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Patrimonio + Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${formatCurrency(totalPatrimonio + resultado)}</p>
              <p className="text-xs text-muted-foreground">
                Patrimonio: ${formatCurrency(totalPatrimonio)} | Resultado: ${formatCurrency(resultado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${balanceCuadrado ? "text-green-600" : "text-red-600"}`}>
                ${formatCurrency(diferencia)}
              </p>
              <p className="text-xs text-muted-foreground">
                {balanceCuadrado ? "Balance cuadrado." : "Revise asientos sin zafra o cuentas fuera de contexto."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">${formatCurrency(totalIngresos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Costos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">${formatCurrency(totalCostos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">${formatCurrency(totalGastos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resultado Neto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-semibold ${resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${formatCurrency(resultado)}
              </p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Cargando balance...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {renderSection("Activo", "Cuentas de activo con saldo dentro del contexto seleccionado.", activos, totalActivo)}
            {renderSection("Pasivo", "Obligaciones pendientes y saldos acreedores.", pasivos, totalPasivo)}
            {renderSection("Patrimonio", "Cuentas patrimoniales acumuladas.", patrimonio, totalPatrimonio)}

            <Card>
              <CardHeader>
                <CardTitle>Resultado del Periodo</CardTitle>
                <CardDescription>Resumen de ingresos, costos y gastos del contexto filtrado.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Ingresos</TableCell>
                      <TableCell className="text-right font-mono">${formatCurrency(totalIngresos)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Costos</TableCell>
                      <TableCell className="text-right font-mono">${formatCurrency(totalCostos)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Gastos</TableCell>
                      <TableCell className="text-right font-mono">${formatCurrency(totalGastos)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Resultado Neto</TableCell>
                      <TableCell className="text-right font-mono">${formatCurrency(resultado)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {(ingresos.length > 0 || costos.length > 0 || gastos.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalle de Resultado</CardTitle>
                  <CardDescription>Cuentas de ingreso, costo y gasto consideradas en el resultado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...ingresos, ...costos, ...gastos].map((row) => (
                        <TableRow key={row.cuentaId}>
                          <TableCell className="capitalize">{row.tipo}</TableCell>
                          <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                          <TableCell>{row.nombre}</TableCell>
                          <TableCell className="text-right font-mono">${formatCurrency(row.saldo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}

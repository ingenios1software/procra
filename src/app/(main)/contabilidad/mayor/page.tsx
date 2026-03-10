"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { AsientoDiario, PlanDeCuenta, Zafra } from "@/lib/types";
import {
  getAsientoZafraLabel,
  matchesAsientoZafraFilter,
  ZAFRA_FILTER_ALL,
  ZAFRA_FILTER_NONE,
} from "@/lib/contabilidad/asientos";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function MayorPage() {
  const tenant = useTenantFirestore();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedZafraId, setSelectedZafraId] = useState<string>(ZAFRA_FILTER_ALL);

  const planDeCuentasQuery = useMemoFirebase(
    () => tenant.query("planDeCuentas", orderBy("codigo")),
    [tenant]
  );
  const { data: planDeCuentas, isLoading: isLoadingCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const asientosQuery = useMemoFirebase(
    () => tenant.query("asientosDiario", orderBy("fecha")),
    [tenant]
  );
  const { data: asientosDiario, isLoading: isLoadingAsientos } = useCollection<AsientoDiario>(asientosQuery);

  const zafrasQuery = useMemoFirebase(
    () => tenant.query("zafras", orderBy("nombre")),
    [tenant]
  );
  const { data: zafras } = useCollection<Zafra>(zafrasQuery);

  useEffect(() => {
    if (!selectedAccountId && (planDeCuentas || []).length > 0) {
      setSelectedAccountId(planDeCuentas![0].id);
    }
  }, [planDeCuentas, selectedAccountId]);

  const { movimientos, totalDebe, totalHaber, saldoFinal, cuentaSeleccionada } = useMemo(() => {
    if (!selectedAccountId || !planDeCuentas || !asientosDiario) {
      return { movimientos: [], totalDebe: 0, totalHaber: 0, saldoFinal: 0, cuentaSeleccionada: null as PlanDeCuenta | null };
    }

    const cuenta = planDeCuentas.find((item) => item.id === selectedAccountId) || null;
    if (!cuenta) {
      return { movimientos: [], totalDebe: 0, totalHaber: 0, saldoFinal: 0, cuentaSeleccionada: null };
    }

    const movimientosCuenta = asientosDiario
      .filter((asiento) => matchesAsientoZafraFilter(asiento, selectedZafraId))
      .flatMap((asiento) =>
        asiento.movimientos
          .filter((mov) => mov.cuentaId === selectedAccountId)
          .map((mov) => ({
            ...mov,
            fecha: asiento.fecha,
            descripcion: asiento.descripcion,
            zafraId: asiento.zafraId,
            zafraNombre: asiento.zafraNombre,
          }))
      )
      .sort((a, b) => new Date(a.fecha as string).getTime() - new Date(b.fecha as string).getTime());

    let saldo = 0;
    let acumuladoDebe = 0;
    let acumuladoHaber = 0;

    const movimientosConSaldo = movimientosCuenta.map((mov) => {
      acumuladoDebe += mov.tipo === "debe" ? mov.monto : 0;
      acumuladoHaber += mov.tipo === "haber" ? mov.monto : 0;

      if (cuenta.naturaleza === "deudora") {
        saldo += mov.tipo === "debe" ? mov.monto : -mov.monto;
      } else {
        saldo += mov.tipo === "haber" ? mov.monto : -mov.monto;
      }

      return { ...mov, saldo };
    });

    return {
      movimientos: movimientosConSaldo,
      totalDebe: acumuladoDebe,
      totalHaber: acumuladoHaber,
      saldoFinal: saldo,
      cuentaSeleccionada: cuenta,
    };
  }, [selectedAccountId, planDeCuentas, asientosDiario, selectedZafraId]);

  return (
    <>
      <PageHeader
        title="Libro Mayor"
        description="Analice los movimientos por cuenta contable y zafra."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seleccion</CardTitle>
          <CardDescription>Elija una cuenta y, si aplica, una zafra para ver su mayor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select onValueChange={setSelectedAccountId} value={selectedAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccione una cuenta contable..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCuentas && <SelectItem value="loading" disabled>Cargando cuentas...</SelectItem>}
              {(planDeCuentas || []).map((cuenta) => (
                <SelectItem key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} - {cuenta.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedZafraId} onValueChange={setSelectedZafraId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por zafra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ZAFRA_FILTER_ALL}>Todas las zafras</SelectItem>
              <SelectItem value={ZAFRA_FILTER_NONE}>Sin zafra</SelectItem>
              {(zafras || []).map((zafra) => (
                <SelectItem key={zafra.id} value={zafra.id}>
                  {zafra.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedAccountId && cuentaSeleccionada && (
        <Card>
          <CardHeader>
            <CardTitle>Mayor de: {cuentaSeleccionada.nombre}</CardTitle>
            <CardDescription>
              Codigo: {cuentaSeleccionada.codigo} | Naturaleza: <span className="capitalize">{cuentaSeleccionada.naturaleza}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAsientos ? (
              <p>Cargando movimientos...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Zafra</TableHead>
                    <TableHead>Descripcion del Asiento</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length > 0 ? (
                    movimientos.map((mov, index) => (
                      <TableRow key={`${mov.fecha}-${index}`}>
                        <TableCell>{format(new Date(mov.fecha as string), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getAsientoZafraLabel(mov)}</Badge>
                        </TableCell>
                        <TableCell>{mov.descripcion}</TableCell>
                        <TableCell className={cn("text-right font-mono", mov.tipo === "debe" && "text-green-600")}>
                          {mov.tipo === "debe"
                            ? `$${mov.monto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "-"}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", mov.tipo === "haber" && "text-red-600")}>
                          {mov.tipo === "haber"
                            ? `$${mov.monto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${mov.saldo.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No hay movimientos para esta cuenta con el filtro aplicado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>Totales</TableCell>
                    <TableCell className="text-right font-mono">${totalDebe.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-mono">${totalHaber.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-mono">${saldoFinal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

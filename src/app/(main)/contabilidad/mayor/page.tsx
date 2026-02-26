"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { AsientoDiario, PlanDeCuenta } from '@/lib/types';

export default function MayorPage() {
  const firestore = useFirestore();

  const planDeCuentasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'planDeCuentas'), orderBy('codigo')) : null, [firestore]);
  const { data: planDeCuentas, isLoading: isLoadingCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);
  
  const asientosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'asientosDiario')) : null, [firestore]);
  const { data: asientosDiario, isLoading: isLoadingAsientos } = useCollection<AsientoDiario>(asientosQuery);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { movimientos, totalDebe, totalHaber, saldoFinal, cuentaSeleccionada } = useMemo(() => {
    if (!selectedAccountId || !planDeCuentas || !asientosDiario) {
      return { movimientos: [], totalDebe: 0, totalHaber: 0, saldoFinal: 0, cuentaSeleccionada: null };
    }

    const cuenta = planDeCuentas.find(c => c.id === selectedAccountId);
    if (!cuenta) {
      return { movimientos: [], totalDebe: 0, totalHaber: 0, saldoFinal: 0, cuentaSeleccionada: null };
    }

    const movimientosCuenta = asientosDiario
      .flatMap(asiento => 
        asiento.movimientos
          .filter(mov => mov.cuentaId === selectedAccountId)
          .map(mov => ({
            ...mov,
            fecha: asiento.fecha,
            descripcion: asiento.descripcion,
          }))
      )
      .sort((a, b) => new Date(a.fecha as string).getTime() - new Date(b.fecha as string).getTime());

    let saldo = 0;
    let totalDebe = 0;
    let totalHaber = 0;

    const movimientosConSaldo = movimientosCuenta.map(mov => {
      totalDebe += mov.tipo === 'debe' ? mov.monto : 0;
      totalHaber += mov.tipo === 'haber' ? mov.monto : 0;
      
      if (cuenta.naturaleza === 'deudora') {
        saldo += mov.tipo === 'debe' ? mov.monto : -mov.monto;
      } else { // acreedora
        saldo += mov.tipo === 'haber' ? mov.monto : -mov.monto;
      }
      return { ...mov, saldo };
    });

    return {
      movimientos: movimientosConSaldo,
      totalDebe,
      totalHaber,
      saldoFinal: saldo,
      cuentaSeleccionada: cuenta
    };
  }, [selectedAccountId, planDeCuentas, asientosDiario]);
  
  // Set initial selected account
  useState(() => {
    if (planDeCuentas && planDeCuentas.length > 0 && !selectedAccountId) {
      setSelectedAccountId(planDeCuentas[0].id);
    }
  });

  return (
    <>
      <PageHeader
        title="Libro Mayor"
        description="Analice los movimientos por cada cuenta contable."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selección de Cuenta</CardTitle>
          <CardDescription>Elija una cuenta para ver su libro mayor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedAccountId} value={selectedAccountId || ''}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Seleccione una cuenta contable..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCuentas && <SelectItem value="loading" disabled>Cargando cuentas...</SelectItem>}
              {planDeCuentas?.map(cuenta => (
                <SelectItem key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} - {cuenta.nombre}
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
              Código: {cuentaSeleccionada.codigo} | Naturaleza: <span className="capitalize">{cuentaSeleccionada.naturaleza}</span>
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
                    <TableHead>Descripción del Asiento</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length > 0 ? movimientos.map((mov, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(mov.fecha as string), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{mov.descripcion}</TableCell>
                      <TableCell className={cn("text-right font-mono", mov.tipo === "debe" && "text-green-600")}>
                        {mov.tipo === "debe" ? `$${mov.monto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono", mov.tipo === "haber" && "text-red-600")}>
                        {mov.tipo === "haber" ? `$${mov.monto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${mov.saldo.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No hay movimientos para esta cuenta en el período seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>Totales</TableCell>
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


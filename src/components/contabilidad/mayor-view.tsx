"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AsientoDiario, PlanDeCuenta } from "@/lib/types";
import { format } from "date-fns";

interface MayorViewProps {
  asientos: AsientoDiario[];
  cuentas: PlanDeCuenta[];
}

export function MayorView({ asientos, cuentas }: MayorViewProps) {
  const [selectedCuentaId, setSelectedCuentaId] = useState<string>(cuentas[0]?.id || "");

  const { movimientos, saldoInicial, saldoFinal, cuentaSeleccionada } = useMemo(() => {
    if (!selectedCuentaId) {
      return { movimientos: [], saldoInicial: 0, saldoFinal: 0, cuentaSeleccionada: null };
    }

    const cuentaSeleccionada = cuentas.find(c => c.id === selectedCuentaId);
    if (!cuentaSeleccionada) {
       return { movimientos: [], saldoInicial: 0, saldoFinal: 0, cuentaSeleccionada: null };
    }

    let saldo = 0;
    const movimientosFiltrados = asientos
      .flatMap(asiento => 
        asiento.movimientos
          .filter(m => m.cuentaId === selectedCuentaId)
          .map(m => ({ ...m, fecha: new Date(asiento.fecha), descripcion: asiento.descripcion }))
      )
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .map(mov => {
        if (cuentaSeleccionada.naturaleza === 'deudora') {
          saldo += (mov.tipo === 'debe' ? mov.monto : -mov.monto);
        } else {
          saldo += (mov.tipo === 'haber' ? mov.monto : -mov.monto);
        }
        return { ...mov, saldo };
      });
    
    return { 
        movimientos: movimientosFiltrados,
        saldoInicial: 0, // Placeholder, needs historical data
        saldoFinal: saldo,
        cuentaSeleccionada 
    };

  }, [selectedCuentaId, asientos, cuentas]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>Selección de Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
           <Select value={selectedCuentaId} onValueChange={setSelectedCuentaId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Seleccione una cuenta para mayorizar" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map(cuenta => (
                  <SelectItem key={cuenta.id} value={cuenta.id}>{cuenta.codigo} - {cuenta.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </CardContent>
      </Card>
      
      {selectedCuentaId && cuentaSeleccionada && (
        <Card>
          <CardHeader>
            <CardTitle>Mayor de la Cuenta: {cuentaSeleccionada.nombre}</CardTitle>
            <CardDescription>
                Naturaleza: <span className="capitalize font-medium">{cuentaSeleccionada.naturaleza}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Saldo Inicial</TableCell>
                    <TableCell className="text-right font-semibold font-mono">${saldoInicial.toLocaleString('es-AR')}</TableCell>
                </TableRow>
                {movimientos.map((mov, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(mov.fecha, "dd/MM/yyyy")}</TableCell>
                    <TableCell>{mov.descripcion}</TableCell>
                    <TableCell className="text-right font-mono">{mov.tipo === 'debe' ? `$${mov.monto.toLocaleString('es-AR')}` : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{mov.tipo === 'haber' ? `$${mov.monto.toLocaleString('es-AR')}` : '-'}</TableCell>
                    <TableCell className="text-right font-mono">${mov.saldo.toLocaleString('es-AR')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-primary">
                    <TableCell colSpan={4} className="font-bold text-primary">Saldo Final</TableCell>
                    <TableCell className="text-right font-bold text-primary font-mono">${saldoFinal.toLocaleString('es-AR')}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

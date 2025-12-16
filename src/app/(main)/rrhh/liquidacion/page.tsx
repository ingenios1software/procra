"use client";

import { useState, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from 'firebase/firestore';
import type { ControlHorario, Empleado } from "@/lib/types";
import { format, getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';

interface LiquidacionData {
    empleadoId: string;
    nombre: string;
    horasTotales: number;
    costoTotal: number;
    salarioBase: number;
}

export default function LiquidacionPage() {
    const firestore = useFirestore();
    const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()));
    const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));

    const { data: empleados, isLoading: l1 } = useCollection<Empleado>(useMemoFirebase(() => firestore ? collection(firestore, 'empleados') : null, [firestore]));

    const registrosQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        const startDate = startOfMonth(new Date(selectedYear, selectedMonth)).toISOString();
        const endDate = endOfMonth(new Date(selectedYear, selectedMonth)).toISOString();
        return query(collection(firestore, 'controlHorario'), where('fecha', '>=', startDate), where('fecha', '<=', endDate), where('estado', '==', 'aprobado'));
    }, [firestore, selectedMonth, selectedYear]);
    const { data: registros, isLoading: l2 } = useCollection<ControlHorario>(registrosQuery);

    const isLoading = l1 || l2;
    
    const liquidacionData: LiquidacionData[] = useMemo(() => {
        if (!empleados || !registros) return [];

        return empleados.map(empleado => {
            const registrosEmpleado = registros.filter(r => r.empleadoId === empleado.id);
            const horasTotales = registrosEmpleado.reduce((sum, r) => sum + r.horasTotales, 0);
            const costoTotal = registrosEmpleado.reduce((sum, r) => sum + r.costoManoDeObra, 0);
            
            return {
                empleadoId: empleado.id,
                nombre: `${empleado.apellido}, ${empleado.nombre}`,
                horasTotales: horasTotales,
                costoTotal: costoTotal,
                salarioBase: empleado.salario,
            };
        }).filter(data => data.horasTotales > 0);
    }, [empleados, registros]);
    
    const totalGeneral = useMemo(() => liquidacionData.reduce((sum, data) => sum + data.costoTotal, 0), [liquidacionData]);
    const totalHorasGenerales = useMemo(() => liquidacionData.reduce((sum, data) => sum + data.horasTotales, 0), [liquidacionData]);

    const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: format(new Date(0, i), 'LLLL') }));
    const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

    return (
        <>
            <PageHeader
                title="Liquidación de Salarios"
                description="Genere un resumen mensual de horas y costos por empleado."
            >
                <Button variant="outline"><Download className="mr-2" /> Exportar</Button>
            </PageHeader>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Selección de Período</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resumen de Liquidación</CardTitle>
                    <CardDescription>
                        Mostrando registros aprobados para {format(new Date(selectedYear, selectedMonth), 'LLLL yyyy')}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empleado</TableHead>
                                <TableHead className="text-right">Horas Totales Trabajadas</TableHead>
                                <TableHead className="text-right">Salario Base</TableHead>
                                <TableHead className="text-right">Monto a Liquidar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={4} className="text-center">Cargando datos...</TableCell></TableRow>}
                            {!isLoading && liquidacionData.map(data => (
                                <TableRow key={data.empleadoId}>
                                    <TableCell className="font-medium">{data.nombre}</TableCell>
                                    <TableCell className="text-right font-mono">{data.horasTotales.toFixed(2)} hs</TableCell>
                                    <TableCell className="text-right font-mono">${data.salarioBase.toLocaleString('de-DE')}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold text-primary">${data.costoTotal.toLocaleString('de-DE', {minimumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && liquidacionData.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No hay registros aprobados para este período.</TableCell></TableRow>}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-lg bg-muted/50">
                                <TableCell>Total General</TableCell>
                                <TableCell className="text-right font-mono">{totalHorasGenerales.toFixed(2)} hs</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">${totalGeneral.toLocaleString('de-DE', {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </>
    );
}

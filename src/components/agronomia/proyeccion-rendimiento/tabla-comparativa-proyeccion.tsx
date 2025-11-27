"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TablaComparativaProyeccionProps {
    data: any[];
}

export function TablaComparativaProyeccion({ data }: TablaComparativaProyeccionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tabla Comparativa de Proyecciones</CardTitle>
                <CardDescription>Comparación del rendimiento proyectado entre todas las parcelas para la zafra seleccionada.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parcela</TableHead>
                            <TableHead className="text-right">Rinde Histórico (kg/ha)</TableHead>
                            <TableHead className="text-right">Proyección Estimada (kg/ha)</TableHead>
                            <TableHead className="text-right">Diferencia vs Histórico (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map(item => {
                            const diff = item.rendimientoHistorico > 0 ? ((item.proyeccionEstimada - item.rendimientoHistorico) / item.rendimientoHistorico) * 100 : 0;
                            return (
                                <TableRow key={item.parcela.id}>
                                    <TableCell className="font-medium">{item.parcela.nombre}</TableCell>
                                    <TableCell className="text-right">{item.rendimientoHistorico.toFixed(0)}</TableCell>
                                    <TableCell className="text-right font-bold">{item.proyeccionEstimada.toFixed(0)}</TableCell>
                                    <TableCell className={cn("text-right font-semibold", diff > 0 ? "text-green-600" : "text-red-600")}>
                                        {diff.toFixed(2)}%
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

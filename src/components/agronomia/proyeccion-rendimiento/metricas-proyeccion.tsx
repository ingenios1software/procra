"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ArrowDownUp, Package, Percent, Droplets, FlaskConical } from "lucide-react";

interface MetricasProyeccionProps {
    data: any;
    parcelaId: string;
}

export function MetricasProyeccion({ data, parcelaId }: MetricasProyeccionProps) {
    if (!data) return null;

    const proyeccion = data.proyeccionEstimada || 0;
    const min = proyeccion * 0.9;
    const max = proyeccion * 1.1;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Proyección/ha</CardTitle><Target/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{proyeccion.toFixed(0)} kg</div>
                    <p className="text-xs text-muted-foreground">Rendimiento estimado por hectárea</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Rango Estimado</CardTitle><ArrowDownUp/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{min.toFixed(0)} - {max.toFixed(0)} kg</div>
                    <p className="text-xs text-muted-foreground">Rango de confianza del 90%</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Producción Total</CardTitle><Package/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{(data.produccionTotal / 1000).toFixed(2) || 'N/A'} tn</div>
                     <p className="text-xs text-muted-foreground">{parcelaId === 'all' ? 'Para todas las parcelas' : 'Estimado para la parcela'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Avance Fenológico</CardTitle><Percent/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">65%</div>
                    <p className="text-xs text-muted-foreground">Etapa R5 - Llenado de granos</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Última Aplicación</CardTitle><FlaskConical/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Fungicida</div>
                    <p className="text-xs text-muted-foreground">Hace 15 días</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Estado Hídrico</CardTitle><Droplets/></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">Normal</div>
                    <p className="text-xs text-muted-foreground">Lluvia de 25mm hace 3 días</p>
                </CardContent>
            </Card>
        </div>
    );
}

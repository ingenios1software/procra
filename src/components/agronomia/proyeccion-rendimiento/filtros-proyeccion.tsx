"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Cultivo, Zafra, Parcela } from "@/lib/types";

interface FiltrosProyeccionProps {
    filters: any;
    setFilters: (filters: any) => void;
    cultivos: Cultivo[];
    zafras: Zafra[];
    parcelas: Parcela[];
}

export function FiltrosProyeccion({ filters, setFilters, cultivos, zafras, parcelas }: FiltrosProyeccionProps) {
    const handleFilterChange = (key: string, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    const modelos = [
        { id: 'historico', nombre: 'Histórico' },
        { id: 'fenologico', nombre: 'Fenológico' },
        { id: 'costo/productividad', nombre: 'Costo/Productividad' },
        { id: 'promedio_movil', nombre: 'Promedio Móvil' },
        { id: 'combinado', nombre: 'Modelo Combinado IA' },
    ];

    return (
        <Card className="no-print">
            <CardHeader>
                <CardTitle>Filtros de Proyección</CardTitle>
                <CardDescription>Seleccione los parámetros para calcular la proyección de rendimiento.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Select value={filters.cultivoId} onValueChange={(v) => handleFilterChange('cultivoId', v)}>
                    <SelectTrigger><SelectValue placeholder="Cultivo" /></SelectTrigger>
                    <SelectContent>{cultivos.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.zafraId} onValueChange={(v) => handleFilterChange('zafraId', v)}>
                    <SelectTrigger><SelectValue placeholder="Zafra" /></SelectTrigger>
                    <SelectContent>{zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.parcelaId} onValueChange={(v) => handleFilterChange('parcelaId', v)}>
                    <SelectTrigger><SelectValue placeholder="Parcela" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las Parcelas</SelectItem>
                        {parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.modelo} onValueChange={(v) => handleFilterChange('modelo', v)}>
                    <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                    <SelectContent>{modelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectContent>
                </Select>
            </CardContent>
        </Card>
    );
}


"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, DollarSign, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CostoForm } from "./costo-form";
import type { Costo, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface CostosListProps {
  initialCostos: Costo[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
}

export function CostosList({ initialCostos, parcelas, zafras, cultivos }: CostosListProps) {
  const [costos, setCostos] = useState(initialCostos);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedCosto, setSelectedCosto] = useState<Costo | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const { totalCostos, costosPorParcela } = useMemo(() => {
    const totalCostos = costos.reduce((acc, costo) => acc + costo.monto, 0);

    const costosPorParcela = parcelas.map(parcela => {
      const costosDeParcela = costos.filter(c => c.parcelaId === parcela.id);
      const costoTotal = costosDeParcela.reduce((sum, c) => sum + c.monto, 0);
      const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
      return {
        id: parcela.id,
        nombre: parcela.nombre,
        superficie: parcela.superficie,
        costoTotal,
        costoPorHa,
      };
    }).filter(p => p.costoTotal > 0);

    return { totalCostos, costosPorParcela };
  }, [costos, parcelas]);

  const handleSave = useCallback((costoData: Costo) => {
    const dataToSave = { ...costoData, fecha: new Date(costoData.fecha) };
    if (selectedCosto) {
      setCostos(prev => prev.map(c => c.id === dataToSave.id ? dataToSave : c));
    } else {
      setCostos(prev => [...prev, { ...dataToSave, id: `cost${prev.length + 1}` }]);
    }
    setDialogOpen(false);
    setSelectedCosto(null);
  }, [selectedCosto]);
  
  const openDialog = useCallback((costo?: Costo) => {
    setSelectedCosto(costo || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedCosto(null);
  }, []);
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Gestión de Costos"
        description="Registre y supervise todos los costos operativos y financieros."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {canModify && (
              <Button onClick={() => openDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Costo
              </Button>
            )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total del Sistema</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostos.toLocaleString('en-US')}</div>
            <p className="text-xs text-muted-foreground">Suma de todos los costos registrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
            <CardHeader>
                <CardTitle>Costo por Parcela</CardTitle>
                <CardDescription>Análisis de costos totales y por hectárea para cada lote.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Superficie (ha)</TableHead>
                            <TableHead className="text-right">Costo Total</TableHead>
                            <TableHead className="text-right">Costo/ha</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costosPorParcela.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.nombre}</TableCell>
                                <TableCell>{p.superficie}</TableCell>
                                <TableCell className="text-right">${p.costoTotal.toLocaleString('en-US')}</TableCell>
                                <TableCell className="text-right font-semibold">${p.costoPorHa.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Comparativa de Costo por Hectárea</CardTitle>
            <CardDescription>Visualización del costo por hectárea entre parcelas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costosPorParcela}>
                <XAxis dataKey="nombre" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                    formatter={(value) => `$${Number(value).toFixed(2)}`} 
                    cursor={{ fill: 'hsla(var(--muted))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))' }}
                />
                <Bar dataKey="costoPorHa" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Listado Detallado de Costos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costos.map((costo) => {
                const parcela = parcelas.find(p => p.id === costo.parcelaId);
                return (
                  <TableRow key={costo.id}>
                    <TableCell>{format(new Date(costo.fecha), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{costo.descripcion}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{costo.tipo}</Badge></TableCell>
                    <TableCell>{parcela?.nombre || 'N/A'}</TableCell>
                    <TableCell className="text-right">${costo.monto.toLocaleString('en-US')}</TableCell>
                    {canModify && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(costo)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCosto ? 'Editar Costo' : 'Registrar Nuevo Costo'}</DialogTitle>
          </DialogHeader>
          <CostoForm
            costo={selectedCosto}
            onSubmit={handleSave}
            onCancel={closeDialog}
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

    
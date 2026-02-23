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
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, query, orderBy } from "firebase/firestore";

export function CostosList() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedCosto, setSelectedCosto] = useState<Costo | null>(null);

  const { data: costos, isLoading: l1 } = useCollection<Costo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'costos'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]));
  const { data: cultivos, isLoading: l3 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]));
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]));
  
  const isLoading = l1 || l2 || l3 || l4;
  const initialCostos = useMemo(() => costos ?? [], [costos]);

  const { totalCostos, costosPorParcela } = useMemo(() => {
    if (!initialCostos || !parcelas) return { totalCostos: 0, costosPorParcela: [] };
    const totalCostos = initialCostos.reduce((acc, costo) => acc + costo.monto, 0);

    const costosPorParcela = parcelas.map(parcela => {
      const costosDeParcela = initialCostos.filter(c => c.parcelaId === parcela.id);
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
  }, [initialCostos, parcelas]);

  const handleSave = useCallback((costoData: Omit<Costo, 'id'>) => {
    if (!firestore) return;
    const dataToSave = { ...costoData, fecha: (costoData.fecha as Date).toISOString() };

    if (selectedCosto) {
      const costoRef = doc(firestore, 'costos', selectedCosto.id);
      updateDocumentNonBlocking(costoRef, dataToSave);
      toast({ title: "Costo actualizado" });
    } else {
      const costosCol = collection(firestore, 'costos');
      addDocumentNonBlocking(costosCol, dataToSave);
      toast({ title: "Costo creado" });
    }
    setDialogOpen(false);
    setSelectedCosto(null);
  }, [selectedCosto, firestore, toast]);
  
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
            {user && (
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
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${'value'}`} />
                <Tooltip 
                    formatter={(value) => `$${(typeof value === 'number' ? value.toFixed(2) : value)}`} 
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
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>}
              {initialCostos.map((costo) => {
                const parcela = parcelas?.find(p => p.id === costo.parcelaId);
                return (
                  <TableRow key={costo.id}>
                    <TableCell>{format(new Date(costo.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{costo.descripcion}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{costo.tipo}</Badge></TableCell>
                    <TableCell>{parcela?.nombre || 'N/A'}</TableCell>
                    <TableCell className="text-right">${costo.monto.toLocaleString('en-US')}</TableCell>
                    {user && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(costo)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
               {!isLoading && initialCostos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No hay costos registrados.</TableCell></TableRow>}
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
            parcelas={parcelas || []}
            cultivos={cultivos || []}
            zafras={zafras || []}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

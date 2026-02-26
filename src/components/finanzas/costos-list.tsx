"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { collection, doc, orderBy, query } from "firebase/firestore";
import { DollarSign, MoreHorizontal, PlusCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { CostoForm } from "./costo-form";
import type { Costo, Cultivo, Parcela, Zafra } from "@/lib/types";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";

export function CostosList() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedCosto, setSelectedCosto] = useState<Costo | null>(null);

  const { data: costos, isLoading: l1 } = useCollection<Costo>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "costos"), orderBy("fecha", "desc")) : null), [firestore])
  );
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "parcelas")) : null), [firestore])
  );
  const { data: cultivos, isLoading: l3 } = useCollection<Cultivo>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "cultivos")) : null), [firestore])
  );
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "zafras")) : null), [firestore])
  );

  const isLoading = l1 || l2 || l3 || l4;
  const initialCostos = useMemo(() => costos ?? [], [costos]);

  const { totalCostos, costosPorParcela } = useMemo(() => {
    const totalCostos = initialCostos.reduce((acc, costo) => acc + costo.monto, 0);

    const costosPorParcela = (parcelas || [])
      .map((parcela) => {
        const costosDeParcela = initialCostos.filter((costo) => costo.parcelaId === parcela.id);
        const costoTotal = costosDeParcela.reduce((sum, costo) => sum + costo.monto, 0);
        const costoPorHa = parcela.superficie > 0 ? costoTotal / parcela.superficie : 0;
        return {
          id: parcela.id,
          nombre: parcela.nombre,
          superficie: parcela.superficie,
          costoTotal,
          costoPorHa,
        };
      })
      .filter((item) => item.costoTotal > 0);

    return { totalCostos, costosPorParcela };
  }, [initialCostos, parcelas]);

  const handleSave = useCallback(
    (costoData: Omit<Costo, "id">) => {
      if (!firestore) return;
      const dataToSave = { ...costoData, fecha: (costoData.fecha as Date).toISOString() };

      if (selectedCosto) {
        updateDocumentNonBlocking(doc(firestore, "costos", selectedCosto.id), dataToSave);
        toast({ title: "Costo actualizado" });
      } else {
        addDocumentNonBlocking(collection(firestore, "costos"), dataToSave);
        toast({ title: "Costo creado" });
      }
      setDialogOpen(false);
      setSelectedCosto(null);
    },
    [selectedCosto, firestore, toast]
  );

  const openDialog = useCallback((costo?: Costo) => {
    setSelectedCosto(costo || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedCosto(null);
  }, []);

  const shareSummary = `Registros de costos: ${initialCostos.length} | Total: $${totalCostos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;

  return (
    <>
      <PageHeader
        title="Gestion de Costos"
        description="Registre y supervise todos los costos operativos y financieros."
      >
        <ReportActions reportTitle="Gestion de Costos" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Costo
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <div className="grid gap-6 md:grid-cols-4 mb-6">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo Total del Sistema</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCostos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Suma de todos los costos registrados</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Costo por Parcela</CardTitle>
              <CardDescription>Analisis de costos totales y por hectarea para cada lote.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Superficie (ha)</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                    <TableHead className="text-right">Costo/ha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costosPorParcela.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">{parcela.nombre}</TableCell>
                      <TableCell>{parcela.superficie}</TableCell>
                      <TableCell className="text-right">${parcela.costoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-semibold">${parcela.costoPorHa.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Comparativa de Costo por Hectarea</CardTitle>
              <CardDescription>Visualizacion del costo por hectarea entre parcelas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costosPorParcela}>
                  <XAxis dataKey="nombre" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value) => `$${typeof value === "number" ? value.toFixed(2) : value}`}
                    cursor={{ fill: "hsla(var(--muted))" }}
                    contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                  />
                  <Bar dataKey="costoPorHa" fill={COMPARATIVE_CHART_COLORS.costo} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado Detallado de Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {initialCostos.map((costo) => {
                  const parcela = parcelas?.find((item) => item.id === costo.parcelaId);
                  return (
                    <TableRow key={costo.id}>
                      <TableCell>{format(new Date(costo.fecha as string), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{costo.descripcion}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {costo.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{parcela?.nombre || "N/A"}</TableCell>
                      <TableCell className="text-right">${costo.monto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                {!isLoading && initialCostos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No hay costos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCosto ? "Editar Costo" : "Registrar Nuevo Costo"}</DialogTitle>
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


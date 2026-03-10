"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { MoreHorizontal, Package, PlusCircle, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { VentaForm } from "./venta-form";
import type { Cliente, Cultivo, Insumo, MovimientoStock, Parcela, Venta, Zafra } from "@/lib/types";
import { COMPARATIVE_CHART_COLORS } from "@/lib/chart-palette";

interface VentasListProps {
  ventas: Venta[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
  clientes: Cliente[];
  isLoading: boolean;
}

export function VentasList({
  ventas,
  parcelas,
  zafras,
  cultivos,
  clientes,
  isLoading,
}: VentasListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const { user } = useUser();
  const tenant = useTenantFirestore();
  const { toast } = useToast();

  const { totalIngresos, rendimientoPorParcela } = useMemo(() => {
    const totalIngresos = ventas.reduce((acc, venta) => acc + (venta.total || 0), 0);

    const rendimientoPorParcela = parcelas
      .map((parcela) => {
        // Las ventas no se imputan por parcela en el modelo actual.
        const rendimientoKgHa = 0;
        return {
          nombre: parcela.nombre,
          rendimiento: rendimientoKgHa,
        };
      })
      .filter((item) => item.rendimiento > 0);

    return { totalIngresos, rendimientoPorParcela };
  }, [ventas, parcelas]);

  const handleSave = useCallback(
    async (ventaData: Omit<Venta, "id">) => {
      if (!tenant.isReady || !tenant.firestore || !user) return;

      const ventasCol = tenant.collection("ventas");
      const movimientosCol = tenant.collection("MovimientosStock");
      if (!ventasCol || !movimientosCol) return;

      const batch = writeBatch(tenant.firestore);
      const ventaRef = selectedVenta ? tenant.doc("ventas", selectedVenta.id) : doc(ventasCol);
      if (!ventaRef) return;
      const dataToSave = { ...ventaData, fecha: (ventaData.fecha as Date).toISOString() };

      if (selectedVenta) {
        batch.update(ventaRef, dataToSave);
      } else {
        batch.set(ventaRef, dataToSave);
      }

      for (const item of ventaData.items) {
        const insumoRef = tenant.doc("insumos", item.productoId);
        if (!insumoRef) continue;
        const insumoDoc = await getDoc(insumoRef);
        if (!insumoDoc.exists()) {
          toast({
            variant: "destructive",
            title: "Error",
            description: `Insumo con ID ${item.productoId} no encontrado.`,
          });
          continue;
        }

        const insumoActual = insumoDoc.data() as Insumo;
        const stockAnterior = insumoActual.stockActual || 0;
        const stockDespues = stockAnterior - item.cantidad;

        batch.update(insumoRef, { stockActual: stockDespues });

        const movimientoRef = doc(movimientosCol);
        const nuevoMovimiento: Omit<MovimientoStock, "id"> = {
          fecha: dataToSave.fecha,
          tipo: "salida",
          origen: "venta",
          ventaId: ventaRef.id,
          documentoOrigen: dataToSave.numeroDocumento,
          insumoId: item.productoId,
          insumoNombre: insumoActual.nombre,
          unidad: insumoActual.unidad,
          categoria: insumoActual.categoria,
          cantidad: item.cantidad,
          stockAntes: stockAnterior,
          stockDespues: stockDespues,
          precioUnitario: item.precioUnitario,
          costoTotal: item.cantidad * item.precioUnitario,
          creadoPor: user.uid,
          creadoEn: new Date(),
        };
        batch.set(movimientoRef, nuevoMovimiento);
      }

      try {
        await batch.commit();
        toast({ title: selectedVenta ? "Venta actualizada" : "Venta creada" });
        setDialogOpen(false);
        setSelectedVenta(null);
      } catch (error) {
        console.error("Error al guardar venta y actualizar stock: ", error);
        toast({
          variant: "destructive",
          title: "Error al guardar",
          description: "Ocurrio un error inesperado.",
        });
      }
    },
    [selectedVenta, tenant, toast, user]
  );

  const openDialog = useCallback((venta?: Venta) => {
    setSelectedVenta(venta || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedVenta(null);
  }, []);

  const getClienteNombre = (id?: string) => {
    if (!id) return "N/A";
    return clientes.find((cliente) => cliente.id === id)?.nombre || "N/A";
  };

  const shareSummary = `Ventas: ${ventas.length} | Ingresos: $${totalIngresos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;

  return (
    <>
      <PageHeader
        title="Gestion de Ventas"
        description="Registre y supervise todas las ventas de produccion."
      >
        <ReportActions reportTitle="Gestion de Ventas" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Venta
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <div className="grid gap-6 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalIngresos.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Suma de todas las ventas registradas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package />
                Produccion por Parcela (Rendimiento)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rendimientoPorParcela}>
                  <XAxis dataKey="nombre" fontSize={12} />
                  <YAxis tickFormatter={(value) => `${value} kg/ha`} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(0)} kg/ha`} />
                  <Bar dataKey="rendimiento" fill={COMPARATIVE_CHART_COLORS.rendimiento} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {ventas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{venta.numeroDocumento}</TableCell>
                    <TableCell className="font-medium">{getClienteNombre(venta.clienteId)}</TableCell>
                    <TableCell className="text-right font-semibold">${(venta.total || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    {user && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(venta)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog modal={false} open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent draggable className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVenta ? "Editar Venta" : "Registrar Nueva Venta"}</DialogTitle>
          </DialogHeader>
          <VentaForm
            venta={selectedVenta}
            onSubmit={handleSave}
            onCancel={closeDialog}
            cultivos={cultivos || []}
            zafras={zafras || []}
            clientes={clientes || []}
            insumos={[]}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}


"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, TrendingUp, Download, Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VentaForm } from "./venta-form";
import type { Venta, Parcela, Zafra, Cultivo, Cliente, Insumo, MovimientoStock } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";

interface VentasListProps {
  ventas: Venta[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
  clientes: Cliente[];
  isLoading: boolean;
}

export function VentasList({ ventas, parcelas, zafras, cultivos, clientes, isLoading }: VentasListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { totalIngresos, rendimientoPorParcela } = useMemo(() => {
    if (!ventas || !parcelas) return { totalIngresos: 0, rendimientoPorParcela: [] };
    
    const totalIngresos = ventas.reduce((acc, venta) => acc + venta.total, 0);

    const rendimientoPorParcela = parcelas.map(parcela => {
        const toneladasVendidas = ventas.flatMap(v => v.items)
            .filter(item => item.parcelaId === parcela.id)
            .reduce((sum, item) => sum + item.cantidad, 0);
        
        const rendimientoKgHa = parcela.superficie > 0 ? (toneladasVendidas * 1000) / parcela.superficie : 0;
        return {
            nombre: parcela.nombre,
            rendimiento: rendimientoKgHa
        }
    }).filter(p => p.rendimiento > 0);

    return { totalIngresos, rendimientoPorParcela };
  }, [ventas, parcelas]);

  const handleSave = useCallback(async (ventaData: Omit<Venta, 'id'>) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    const ventaRef = selectedVenta ? doc(firestore, 'ventas', selectedVenta.id) : doc(collection(firestore, 'ventas'));
    
    const dataToSave = { ...ventaData, fecha: (ventaData.fecha as Date).toISOString() };
    
    if (selectedVenta) {
        batch.update(ventaRef, dataToSave);
    } else {
        batch.set(ventaRef, dataToSave);
    }
    
    // --- Lógica de Stock ---
    for (const item of ventaData.items) {
        const insumoRef = doc(firestore, "insumos", item.insumoId);
        const insumoDoc = await getDoc(insumoRef);
        if (!insumoDoc.exists()) {
            toast({ variant: "destructive", title: "Error", description: `Insumo con ID ${item.insumoId} no encontrado.` });
            continue; // Saltar este item si no se encuentra el insumo
        }
        const insumoActual = insumoDoc.data() as Insumo;
        const stockAnterior = insumoActual.stockActual || 0;
        const stockDespues = stockAnterior - item.cantidad;

        // 1. Actualizar stock del insumo
        batch.update(insumoRef, { stockActual: stockDespues });

        // 2. Crear movimiento de stock
        const movimientoRef = doc(collection(firestore, "MovimientosStock"));
        const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
            fecha: dataToSave.fecha,
            tipo: "salida",
            origen: "venta",
            ventaId: ventaRef.id,
            documentoOrigen: dataToSave.documento,
            insumoId: item.insumoId,
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
        closeDialog();
    } catch (error) {
        console.error("Error al guardar venta y actualizar stock: ", error);
        toast({ variant: "destructive", title: "Error al guardar", description: "Ocurrió un error inesperado."});
    }

  }, [selectedVenta, firestore, toast, user]);
  
  const openDialog = useCallback((venta?: Venta) => {
    setSelectedVenta(venta || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedVenta(null);
  }, []);

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const getClienteNombre = (id?: string) => {
    if (!id || !clientes) return 'N/A';
    return clientes.find(c => c.id === id)?.nombre || 'N/A';
  }
  
  const getCultivoNombre = (id: string) => {
    if (!cultivos) return 'N/A';
    return cultivos.find(c => c.id === id)?.nombre || 'N/A';
  }

  return (
    <>
      <PageHeader
        title="Gestión de Ventas"
        description="Registre y supervise todas las ventas de producción."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {user && (
              <Button onClick={() => openDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Venta
              </Button>
            )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalIngresos.toLocaleString('en-US')}</div>
            <p className="text-xs text-muted-foreground">Suma de todas las ventas registradas</p>
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package /> Producción por Parcela (Rendimiento)</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rendimientoPorParcela}>
                        <XAxis dataKey="nombre" fontSize={12} />
                        <YAxis tickFormatter={(value) => `${value} kg/ha`} />
                        <Tooltip formatter={(value) => `${Number(value).toFixed(0)} kg/ha`} />
                        <Bar dataKey="rendimiento" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
       </div>
      
      <Card>
        <CardHeader><CardTitle>Listado de Ventas</CardTitle></CardHeader>
        <CardContent>
          <Table>
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
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando...</TableCell></TableRow>}
              {ventas.map((venta) => {
                return (
                  <TableRow key={venta.id}>
                    <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{venta.documento}</TableCell>
                    <TableCell className="font-medium">{getClienteNombre(venta.clienteId)}</TableCell>
                    <TableCell className="text-right font-semibold">${venta.total.toLocaleString('en-US')}</TableCell>
                    {user && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(venta)}>
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVenta ? 'Editar Venta' : 'Registrar Nueva Venta'}</DialogTitle>
          </DialogHeader>
          <VentaForm
            venta={selectedVenta}
            onSubmit={handleSave}
            onCancel={closeDialog}
            parcelas={parcelas || []}
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

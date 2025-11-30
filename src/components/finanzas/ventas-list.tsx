
"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, TrendingUp, Download, Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VentaForm } from "./venta-form";
import type { Venta, Parcela, Zafra, Cultivo, Cliente } from "@/lib/types";
import { useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useFirestore } from "@/firebase";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { collection, doc } from 'firebase/firestore';

interface VentasListProps {
  ventas: Venta[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
  clientes: Cliente[];
  isLoading: boolean;
}

export function VentasList({ ventas, parcelas, zafras, cultivos, clientes, isLoading }: VentasListProps) {
  const firestore = useFirestore();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const { user } = useUser();
  
  const { totalIngresos, rendimientoPorParcela } = useMemo(() => {
    const totalIngresos = ventas.reduce((acc, venta) => acc + (venta.toneladas * venta.precioTonelada), 0);

    const rendimientoPorParcela = parcelas.map(parcela => {
        const ventasParcela = ventas.filter(v => v.parcelaId === parcela.id);
        const totalToneladas = ventasParcela.reduce((sum, v) => sum + v.toneladas, 0);
        const rendimientoKgHa = parcela.superficie > 0 ? (totalToneladas * 1000) / parcela.superficie : 0;
        return {
            nombre: parcela.nombre,
            rendimiento: rendimientoKgHa
        }
    }).filter(p => p.rendimiento > 0);

    return { totalIngresos, rendimientoPorParcela };
  }, [ventas, parcelas]);

  const handleSave = useCallback((ventaData: Omit<Venta, 'id'>) => {
    if (!firestore) return;
    const dataToSave = { ...ventaData, fecha: (ventaData.fecha as Date).toISOString() };
    if (selectedVenta?.id) {
      const ventaRef = doc(firestore, 'ventas', selectedVenta.id);
      updateDocumentNonBlocking(ventaRef, dataToSave);
    } else {
      const ventasCol = collection(firestore, 'ventas');
      addDocumentNonBlocking(ventasCol, dataToSave);
    }
    setDialogOpen(false);
    setSelectedVenta(null);
  }, [selectedVenta, firestore]);
  
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
    if (!id) return 'N/A';
    return clientes.find(c => c.id === id)?.nombre || 'N/A';
  }
  
  const getCultivoNombre = (id: string) => {
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
                <TableHead>Cliente</TableHead>
                <TableHead>Cultivo</TableHead>
                <TableHead>Toneladas</TableHead>
                <TableHead>Precio/Ton</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center">Cargando...</TableCell></TableRow>}
              {ventas.map((venta) => {
                const total = venta.toneladas * venta.precioTonelada;
                return (
                  <TableRow key={venta.id}>
                    <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{getClienteNombre(venta.clienteId)}</TableCell>
                    <TableCell className="font-medium">{getCultivoNombre(venta.cultivoId)}</TableCell>
                    <TableCell>{venta.toneladas} tn</TableCell>
                    <TableCell>${venta.precioTonelada.toLocaleString('en-US')}</TableCell>
                    <TableCell className="text-right font-semibold">${total.toLocaleString('en-US')}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVenta ? 'Editar Venta' : 'Registrar Nueva Venta'}</DialogTitle>
          </DialogHeader>
          <VentaForm
            venta={selectedVenta}
            onSubmit={handleSave}
            onCancel={closeDialog}
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
            clientes={clientes}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

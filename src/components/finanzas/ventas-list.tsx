"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VentaForm } from "./venta-form";
import type { Venta, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

interface VentasListProps {
  initialVentas: Venta[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
}

export function VentasList({ initialVentas, parcelas, zafras, cultivos }: VentasListProps) {
  const [ventas, setVentas] = useState(initialVentas);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const totalIngresos = useMemo(() => {
    return ventas.reduce((acc, venta) => acc + (venta.toneladas * venta.precioTonelada), 0);
  }, [ventas]);

  const handleSave = (ventaData: Venta) => {
    if (selectedVenta) {
      setVentas(prev => prev.map(v => v.id === ventaData.id ? ventaData : v));
    } else {
      setVentas(prev => [...prev, { ...ventaData, id: `venta${prev.length + 1}` }]);
    }
    setDialogOpen(false);
    setSelectedVenta(null);
  };
  
  const openDialog = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Ventas"
        description="Registre y supervise todas las ventas de producción."
      >
        {canModify && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Venta
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalIngresos.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Suma de todas las ventas registradas</p>
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
                <TableHead>Cultivo</TableHead>
                <TableHead>Toneladas</TableHead>
                <TableHead>Precio/Ton</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((venta) => {
                const cultivo = cultivos.find(c => c.id === venta.cultivoId);
                const total = venta.toneladas * venta.precioTonelada;
                return (
                  <TableRow key={venta.id}>
                    <TableCell>{format(venta.fecha, "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{cultivo?.nombre || 'N/A'}</TableCell>
                    <TableCell>{venta.toneladas} tn</TableCell>
                    <TableCell>${venta.precioTonelada.toLocaleString('es-AR')}</TableCell>
                    <TableCell className="text-right font-semibold">${total.toLocaleString('es-AR')}</TableCell>
                    {canModify && (
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
            onCancel={() => setDialogOpen(false)}
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

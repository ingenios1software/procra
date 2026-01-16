"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Venta, Cliente, Deposito } from "@/lib/types";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VentaForm } from "@/components/comercial/ventas/venta-form";
import { MoreHorizontal } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { formatCurrency } from "@/lib/utils";

export default function VentasPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

  const { data: ventas, isLoading: isLoadingVentas } = useCollection<Venta>(useMemoFirebase(() => firestore ? query(collection(firestore, 'ventas'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(useMemoFirebase(() => firestore ? query(collection(firestore, 'clientes')) : null, [firestore]));

  const getClienteNombre = (id: string) => clientes?.find(c => c.id === id)?.nombre || 'N/A';

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const openForm = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedVenta(null);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Ventas"
        description="Consulte, edite y registre las ventas de productos."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {user && (
              <Button onClick={() => openForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Venta
              </Button>
            )}
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoadingVentas || isLoadingClientes) && <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>}
              {ventas?.map((venta) => (
                <TableRow key={venta.id}>
                  <TableCell>{venta.numeroDocumento}</TableCell>
                  <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{getClienteNombre(venta.clienteId)}</TableCell>
                  <TableCell>{venta.moneda}</TableCell>
                  <TableCell className="text-right font-mono">${formatCurrency(venta.total)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openForm(venta)}>Ver/Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Anular</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-6xl h-screen md:h-auto">
           <DialogHeader>
             <DialogTitle>{selectedVenta ? `Editar Venta N° ${selectedVenta.numeroDocumento}`: 'Registrar Nueva Venta'}</DialogTitle>
             <DialogDescription>
                Complete los detalles de la factura o documento de venta.
             </DialogDescription>
           </DialogHeader>
            <div className="overflow-y-auto max-h-[85vh] p-1">
              <VentaForm venta={selectedVenta} onCancel={closeForm} />
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

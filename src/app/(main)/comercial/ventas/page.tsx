"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { collection, orderBy, query, where } from "firebase/firestore";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { formatCurrency } from "@/lib/utils";
import { VentaForm } from "@/components/comercial/ventas/venta-form";
import type { Cliente, CuentaCajaBanco, Deposito, Venta, Zafra } from "@/lib/types";

export default function VentasPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

  const { data: ventas, isLoading: isLoadingVentas } = useCollection<Venta>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "ventas"), orderBy("fecha", "desc")) : null),
      [firestore]
    )
  );
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "clientes")) : null), [firestore])
  );
  const { data: depositos, isLoading: isLoadingDepositos } = useCollection<Deposito>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "depositos")) : null), [firestore])
  );
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(
    useMemoFirebase(
      () => (firestore ? query(collection(firestore, "cuentasCajaBanco"), where("activo", "==", true)) : null),
      [firestore]
    )
  );
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(
    useMemoFirebase(() => (firestore ? query(collection(firestore, "zafras")) : null), [firestore])
  );

  const getClienteNombre = (id: string) => clientes?.find((cliente) => cliente.id === id)?.nombre || "N/A";

  const openForm = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedVenta(null);
  };

  const totalVentas = useMemo(
    () => (ventas || []).reduce((sum, venta) => sum + (venta.total || 0), 0),
    [ventas]
  );
  const shareSummary = `Ventas: ${ventas?.length || 0} | Total: $${formatCurrency(totalVentas)}.`;

  return (
    <>
      <PageHeader
        title="Gestion de Ventas"
        description="Consulte, edite y registre las ventas de productos."
      >
        <ReportActions reportTitle="Gestion de Ventas" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[820px]">
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
                {(isLoadingVentas || isLoadingClientes || isLoadingDepositos || isLoadingZafras) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {ventas?.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{venta.numeroDocumento}</TableCell>
                    <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{getClienteNombre(venta.clienteId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{venta.moneda}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">${formatCurrency(venta.total)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
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
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {selectedVenta ? `Editar Venta NÂ° ${selectedVenta.numeroDocumento}` : "Registrar Nueva Venta"}
            </DialogTitle>
            <DialogDescription>Complete los detalles de la factura o documento de venta.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70dvh] sm:max-h-[78dvh] p-1 pr-2">
            <VentaForm
              venta={selectedVenta}
              onCancel={closeForm}
              clientes={clientes || []}
              depositos={depositos || []}
              cuentasCajaBanco={cuentasCajaBanco || []}
              zafras={zafras || []}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

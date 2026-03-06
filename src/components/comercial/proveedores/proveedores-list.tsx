"use client";

import Link from "next/link";
import { useState } from "react";
import { collection, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { ProveedorForm } from "./proveedor-form";
import type { Proveedor } from "@/lib/types";

interface ProveedoresListProps {
  proveedores: Proveedor[];
  isLoading: boolean;
}

export function ProveedoresList({ proveedores, isLoading }: ProveedoresListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);

  const handleSave = async (proveedorData: Omit<Proveedor, "id">) => {
    if (!firestore) return;

    if (selectedProveedor) {
      updateDocumentNonBlocking(doc(firestore, "proveedores", selectedProveedor.id), proveedorData);
      toast({ title: "Proveedor actualizado" });
    } else {
      const proveedoresCol = collection(firestore, "proveedores");
      const lastQuery = query(proveedoresCol, orderBy("numeroItem", "desc"), limit(1));
      const snapshot = await getDocs(lastQuery);
      let maxNumeroItem = 0;
      if (!snapshot.empty) {
        maxNumeroItem = snapshot.docs[0].data().numeroItem || 0;
      }
      addDocumentNonBlocking(proveedoresCol, { ...proveedorData, numeroItem: maxNumeroItem + 1 });
      toast({ title: "Proveedor creado" });
    }
    closeForm();
  };

  const openForm = (proveedor?: Proveedor) => {
    setSelectedProveedor(proveedor || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedProveedor(null);
  };

  const shareSummary = `Total de proveedores: ${proveedores.length}.`;

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Gestione los proveedores de insumos y servicios."
      >
        <ReportActions reportTitle="Proveedores" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Proveedor
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item NÂº</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RUC</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Email</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>Cargando...</TableCell>
                  </TableRow>
                )}
                {proveedores.map((proveedor) => (
                  <TableRow key={proveedor.id}>
                    <TableCell className="font-medium text-muted-foreground">{proveedor.numeroItem}</TableCell>
                    <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                    <TableCell>{proveedor.ruc}</TableCell>
                    <TableCell>{proveedor.telefono || "N/A"}</TableCell>
                    <TableCell>{proveedor.email || "N/A"}</TableCell>
                    {user && (
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
                            <DropdownMenuItem asChild>
                              <Link href={`/comercial/proveedores/editar/${proveedor.id}`}>Editar</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog modal={false} open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>{selectedProveedor ? "Editar Proveedor" : "Crear Nuevo Proveedor"}</DialogTitle>
            <DialogDescription>Complete los detalles del proveedor.</DialogDescription>
          </DialogHeader>
          <ProveedorForm proveedor={selectedProveedor} onSubmit={handleSave} onCancel={closeForm} />
        </DialogContent>
      </Dialog>
    </>
  );
}

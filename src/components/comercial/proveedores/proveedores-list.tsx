"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Proveedor } from "@/lib/types";
import { useUser } from "@/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProveedorForm } from "./proveedor-form";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useFirestore } from "@/firebase";

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
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const handleSave = async (proveedorData: Omit<Proveedor, 'id'>) => {
    if(!firestore) return;
    
    if (selectedProveedor) {
      updateDocumentNonBlocking(doc(firestore, 'proveedores', selectedProveedor.id), proveedorData);
      toast({title: "Proveedor actualizado"});
    } else {
      const proveedoresCol = collection(firestore, 'proveedores');
      const q = query(proveedoresCol, orderBy("numeroItem", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let maxNumeroItem = 0;
      if (!querySnapshot.empty) {
          maxNumeroItem = querySnapshot.docs[0].data().numeroItem || 0;
      }
      const numeroItem = maxNumeroItem + 1;
      addDocumentNonBlocking(proveedoresCol, { ...proveedorData, numeroItem });
      toast({title: "Proveedor creado"});
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
  }

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Gestione los proveedores de insumos y servicios."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          {user && (
            <Button onClick={() => openForm()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Proveedor
            </Button>
          )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Nº</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>}
              {proveedores.map((proveedor) => (
                <TableRow key={proveedor.id}>
                  <TableCell className="font-medium text-muted-foreground">{proveedor.numeroItem}</TableCell>
                  <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                  <TableCell>{proveedor.ruc}</TableCell>
                  <TableCell>{proveedor.telefono || 'N/A'}</TableCell>
                  <TableCell>{proveedor.email || 'N/A'}</TableCell>
                  {user && (
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
                          <DropdownMenuItem onClick={() => openForm(proveedor)}>Editar</DropdownMenuItem>
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

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedProveedor ? 'Editar Proveedor' : 'Crear Nuevo Proveedor'}</DialogTitle>
              <DialogDescription>Complete los detalles del nuevo proveedor.</DialogDescription>
            </DialogHeader>
            <ProveedorForm proveedor={selectedProveedor} onSubmit={handleSave} onCancel={closeForm} />
        </DialogContent>
      </Dialog>
    </>
  );
}

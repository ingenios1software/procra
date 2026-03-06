"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { CentroDeCostoForm } from "@/components/contabilidad/centros-de-costo/centro-de-costo-form";
import type { CentroDeCosto } from "@/lib/types";
import { useUser, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { collection, doc, query, orderBy } from 'firebase/firestore';

export default function CentrosDeCostoPage() {
  const firestore = useFirestore();
  const centrosDeCostoQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'centrosDeCosto'), orderBy('nombre')) : null
  , [firestore]);
  const { data: centros, isLoading } = useCollection<CentroDeCosto>(centrosDeCostoQuery);
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedCentro, setSelectedCentro] = useState<CentroDeCosto | null>(
    null
  );
  const { user } = useUser();
  const { toast } = useToast();

  const handleSave = (centroData: Omit<CentroDeCosto, "id">) => {
    if (!firestore) return;
    if (selectedCentro) {
      // Update
      const centroRef = doc(firestore, 'centrosDeCosto', selectedCentro.id);
      updateDocumentNonBlocking(centroRef, centroData);
      toast({
        title: "Centro de costo actualizado",
        description: `El centro "${centroData.nombre}" ha sido actualizado.`,
      });
    } else {
      // Create
      const centrosCol = collection(firestore, 'centrosDeCosto');
      addDocumentNonBlocking(centrosCol, centroData);
      toast({
        title: "Centro de costo creado",
        description: `El centro "${centroData.nombre}" ha sido creado.`,
      });
    }
    setFormOpen(false);
    setSelectedCentro(null);
  };

  const handleDelete = (id: string) => {
    if(!firestore || !centros) return;
    const centro = centros.find((c) => c.id === id);
    const centroRef = doc(firestore, 'centrosDeCosto', id);
    deleteDocumentNonBlocking(centroRef);
    toast({
      variant: "destructive",
      title: "Centro de costo eliminado",
      description: `El centro "${centro?.nombre}" ha sido eliminado.`,
    });
  };

  const openForm = (centro?: CentroDeCosto) => {
    setSelectedCentro(centro || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Centros de Costo"
        description="Gestione las unidades de negocio para la imputación de costos."
      >
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nuevo Centro de Costo
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Centros de Costo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                {user && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4}>Cargando...</TableCell></TableRow>}
              {centros?.map((centro) => (
                <TableRow key={centro.id}>
                  <TableCell className="font-medium">{centro.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{centro.categoria}</Badge>
                  </TableCell>
                  <TableCell>{centro.descripcion}</TableCell>
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
                          <DropdownMenuItem onClick={() => openForm(centro)}>
                            Editar
                          </DropdownMenuItem>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive"
                              >
                                Eliminar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  ¿Está seguro de que desea eliminar este centro de costo?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(centro.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
      <Dialog modal={false} open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent draggable className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCentro ? "Editar Centro de Costo" : "Crear Centro de Costo"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles del centro de costo.
            </DialogDescription>
          </DialogHeader>
          <CentroDeCostoForm
            centro={selectedCentro}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedCentro(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

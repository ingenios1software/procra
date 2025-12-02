"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CultivoForm } from "./cultivo-form";
import type { Cultivo } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, getCountFromServer } from 'firebase/firestore';


interface CultivosListProps {
  initialCultivos: Cultivo[];
  isLoading: boolean;
}

export function CultivosList({ initialCultivos, isLoading }: CultivosListProps) {
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCultivo, setSelectedCultivo] = useState<Cultivo | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleCreate = async (cultivoData: Omit<Cultivo, 'id'>) => {
    if (!firestore) return;
    const cultivosCol = collection(firestore, 'cultivos');
    const snapshot = await getCountFromServer(cultivosCol);
    const numeroItem = snapshot.data().count + 1;

    addDocumentNonBlocking(cultivosCol, { ...cultivoData, numeroItem });
    toast({ title: "Cultivo creado", description: `El cultivo "${cultivoData.nombre}" (Item Nº ${numeroItem}) ha sido creado.` });
    setCreateDialogOpen(false);
  };

  const handleUpdate = (cultivoData: Omit<Cultivo, 'id'>) => {
    if (!firestore || !selectedCultivo) return;
    const cultivoRef = doc(firestore, 'cultivos', selectedCultivo.id);
    updateDocumentNonBlocking(cultivoRef, cultivoData);
    toast({ title: "Cultivo actualizado", description: `El cultivo "${cultivoData.nombre}" ha sido actualizado.` });
    setEditDialogOpen(false);
    setSelectedCultivo(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const cultivo = initialCultivos.find(c => c.id === id);
    const cultivoRef = doc(firestore, 'cultivos', id);
    deleteDocumentNonBlocking(cultivoRef);
    toast({ variant: "destructive", title: "Cultivo eliminado", description: `El cultivo "${cultivo?.nombre}" ha sido eliminado.` });
  };
  
  const openEditDialog = (cultivo: Cultivo) => {
    setSelectedCultivo(cultivo);
    setEditDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Cultivos"
        description="Gestione los tipos de cultivos de su establecimiento."
      >
        {user && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Cultivo
          </Button>
        )}
      </PageHeader>
      
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Nº</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center">Cargando cultivos...</TableCell>
                </TableRow>
              )}
              {!isLoading && initialCultivos.map((cultivo) => (
                <TableRow key={cultivo.id}>
                  <TableCell className="font-medium text-muted-foreground">{cultivo.numeroItem}</TableCell>
                  <TableCell className="font-medium">{cultivo.nombre}</TableCell>
                  <TableCell>{cultivo.descripcion}</TableCell>
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
                          <DropdownMenuItem onClick={() => openEditDialog(cultivo)}>Editar</DropdownMenuItem>
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Eliminar</DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente el cultivo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(cultivo.id)} className="bg-destructive hover:bg-destructive/90">Continuar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
               {!isLoading && initialCultivos.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No se encontraron cultivos. Puede crear uno nuevo.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cultivo</DialogTitle>
          </DialogHeader>
          <CultivoForm onSubmit={handleCreate} onCancel={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cultivo</DialogTitle>
          </DialogHeader>
          {selectedCultivo && <CultivoForm cultivo={selectedCultivo} onSubmit={handleUpdate} onCancel={() => setEditDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

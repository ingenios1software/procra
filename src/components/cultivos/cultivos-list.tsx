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
import { useAuth } from "@/hooks/use-auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CultivosListProps {
  initialCultivos: Cultivo[];
  onAdd: (data: Omit<Cultivo, 'id'>) => void;
  onUpdate: (data: Cultivo) => void;
  onDelete: (id: string) => void;
}

export function CultivosList({ initialCultivos, onAdd, onUpdate, onDelete }: CultivosListProps) {
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCultivo, setSelectedCultivo] = useState<Cultivo | null>(null);
  const { user } = useAuth();
  const canModify = user && user.rol === 'admin';

  const handleCreate = (cultivoData: Omit<Cultivo, 'id'>) => {
    onAdd(cultivoData);
    setCreateDialogOpen(false);
  };

  const handleUpdate = (cultivoData: Omit<Cultivo, 'id'>) => {
    if (selectedCultivo) {
      onUpdate({ ...selectedCultivo, ...cultivoData });
    }
    setEditDialogOpen(false);
    setSelectedCultivo(null);
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
        {canModify && (
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
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCultivos.map((cultivo) => (
                <TableRow key={cultivo.id}>
                  <TableCell className="font-medium">{cultivo.nombre}</TableCell>
                  <TableCell>{cultivo.descripcion}</TableCell>
                  {canModify && (
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
                                  <AlertDialogAction onClick={() => onDelete(cultivo.id)}>Continuar</AlertDialogAction>
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

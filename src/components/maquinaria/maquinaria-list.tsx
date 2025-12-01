"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, PlusCircle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Maquinaria } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { cn } from "@/lib/utils";
import { MaquinariaForm } from "./maquinaria-form";
import { useToast } from "@/hooks/use-toast";
import { collection, doc } from "firebase/firestore";

interface MaquinariaListProps {
  maquinaria: Maquinaria[];
  isLoading: boolean;
}

export function MaquinariaList({ maquinaria, isLoading }: MaquinariaListProps) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedMaquinaria, setSelectedMaquinaria] = useState<Maquinaria | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSave = (maquinariaData: Omit<Maquinaria, "id">) => {
    if (!firestore) return;
    if (selectedMaquinaria) {
      const maquinariaRef = doc(firestore, 'maquinaria', selectedMaquinaria.id);
      updateDocumentNonBlocking(maquinariaRef, maquinariaData);
      toast({ title: "Maquinaria actualizada", description: `Los datos de "${maquinariaData.nombre}" han sido actualizados.` });
    } else {
      const maquinariaCol = collection(firestore, 'maquinaria');
      addDocumentNonBlocking(maquinariaCol, maquinariaData);
      toast({ title: "Maquinaria creada", description: `La maquinaria "${maquinariaData.nombre}" ha sido registrada.` });
    }
    setFormOpen(false);
    setSelectedMaquinaria(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const maq = maquinaria.find(m => m.id === id);
    const maquinariaRef = doc(firestore, 'maquinaria', id);
    deleteDocumentNonBlocking(maquinariaRef);
    toast({ variant: "destructive", title: "Maquinaria eliminada", description: `La maquinaria "${maq?.nombre}" ha sido eliminada.` });
  };

  const openForm = (maquinaria?: Maquinaria) => {
    setSelectedMaquinaria(maquinaria || null);
    setFormOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Listado de Maquinaria</CardTitle>
          {user && (
            <Button onClick={() => openForm()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Maquinaria
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horas de Trabajo</TableHead>
                <TableHead>Estado</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando maquinaria...</TableCell></TableRow>}
              {maquinaria.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{item.tipo}</Badge>
                  </TableCell>
                  <TableCell>{item.horasTrabajo} hs</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-green-600 text-primary-foreground": item.estado === "operativa",
                        "bg-amber-500 text-amber-foreground": item.estado === "en mantenimiento",
                        "bg-destructive text-destructive-foreground": item.estado === "fuera de servicio",
                      })}
                    >
                      {item.estado}
                    </Badge>
                  </TableCell>
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
                          <DropdownMenuItem onClick={() => openForm(item)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Wrench className="mr-2 h-4 w-4" /> Registrar Mantenimiento
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
                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer y eliminará la maquinaria.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
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

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>
              {selectedMaquinaria ? "Editar Maquinaria" : "Crear Nueva Maquinaria"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles del equipo.
            </DialogDescription>
          </DialogHeader>
          <MaquinariaForm
            maquinaria={selectedMaquinaria}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedMaquinaria(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

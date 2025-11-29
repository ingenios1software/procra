"use client";

import { useState, useMemo } from "react";
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
import { useAuth, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MaquinariaForm } from "./maquinaria-form";
import { collection, doc, query, orderBy } from 'firebase/firestore';


export function MaquinariaList() {
  const firestore = useFirestore();
  const maquinariasQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'maquinarias'), orderBy('nombre')) : null
  , [firestore]);
  const { data: maquinarias, isLoading } = useCollection<Maquinaria>(maquinariasQuery);

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedMaquinaria, setSelectedMaquinaria] = useState<Maquinaria | null>(null);
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === "admin" || role === "operador" || role === "gerente";

  const handleSave = (maquinariaData: Omit<Maquinaria, "id">) => {
    if (!firestore) return;
    if (selectedMaquinaria) {
      const maquinariaRef = doc(firestore, 'maquinarias', selectedMaquinaria.id);
      updateDocumentNonBlocking(maquinariaRef, maquinariaData);
      toast({ title: "Maquinaria actualizada", description: `Los datos de "${maquinariaData.nombre}" han sido actualizados.` });
    } else {
      const maquinariasCol = collection(firestore, 'maquinarias');
      addDocumentNonBlocking(maquinariasCol, maquinariaData);
      toast({ title: "Maquinaria creada", description: `La maquinaria "${maquinariaData.nombre}" ha sido registrada.` });
    }
    setFormOpen(false);
    setSelectedMaquinaria(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore || !maquinarias) return;
    const maquinaria = maquinarias.find(m => m.id === id);
    const maquinariaRef = doc(firestore, 'maquinarias', id);
    deleteDocumentNonBlocking(maquinariaRef);
    toast({ variant: "destructive", title: "Maquinaria eliminada", description: `La maquinaria "${maquinaria?.nombre}" ha sido eliminada.` });
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
          {canModify && (
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
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
              {maquinarias?.map((maquinaria) => (
                <TableRow key={maquinaria.id}>
                  <TableCell className="font-medium">{maquinaria.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{maquinaria.tipo}</Badge>
                  </TableCell>
                  <TableCell>{maquinaria.horasTrabajo} hs</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-green-600 text-primary-foreground": maquinaria.estado === "operativa",
                        "bg-amber-500 text-amber-foreground": maquinaria.estado === "en mantenimiento",
                        "bg-destructive text-destructive-foreground": maquinaria.estado === "fuera de servicio",
                      })}
                    >
                      {maquinaria.estado.replace(/([A-Z])/g, " $1")}
                    </Badge>
                  </TableCell>
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
                          <DropdownMenuItem onClick={() => openForm(maquinaria)}>
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
                                  onClick={() => handleDelete(maquinaria.id)}
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

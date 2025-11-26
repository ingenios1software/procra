"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PlagaForm } from "@/components/agronomia/plagas/plaga-form";
import type { Plaga, Cultivo } from "@/lib/types";
import { mockPlagas, mockCultivos } from "@/lib/mock-data";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function PlagasPage() {
  const [plagas, setPlagas] = useState(mockPlagas);
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedPlaga, setSelectedPlaga] = useState<Plaga | null>(null);
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === "admin" || role === "tecnicoCampo";

  const getCultivoNombres = (cultivoIds: string[]) => {
    return cultivoIds
      .map((id) => mockCultivos.find((c) => c.id === id)?.nombre)
      .filter(Boolean)
      .join(", ");
  };

  const handleSave = (plagaData: Omit<Plaga, "id">) => {
    if (selectedPlaga) {
      // Update
      const updatedPlaga = { ...selectedPlaga, ...plagaData };
      setPlagas((prev) =>
        prev.map((p) => (p.id === updatedPlaga.id ? updatedPlaga : p))
      );
      toast({ title: "Plaga actualizada", description: `La plaga "${updatedPlaga.nombre}" ha sido actualizada.` });
    } else {
      // Create
      const newPlaga: Plaga = {
        id: `plaga-${Date.now()}`,
        ...plagaData,
      };
      setPlagas((prev) => [...prev, newPlaga]);
      toast({ title: "Plaga creada", description: `La plaga "${newPlaga.nombre}" ha sido creada.` });
    }
    setFormOpen(false);
    setSelectedPlaga(null);
  };

  const handleDelete = (id: string) => {
    const plaga = plagas.find(p => p.id === id);
    setPlagas((prev) => prev.filter((p) => p.id !== id));
    toast({ variant: "destructive", title: "Plaga eliminada", description: `La plaga "${plaga?.nombre}" ha sido eliminada.` });
  };

  const openForm = (plaga?: Plaga) => {
    setSelectedPlaga(plaga || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Plagas"
        description="Administre el catálogo de plagas y enfermedades."
      >
        {canModify && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nueva Plaga
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Plagas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cultivos Afectados</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plagas.map((plaga) => (
                <TableRow key={plaga.id}>
                  <TableCell className="font-medium">{plaga.nombre}</TableCell>
                  <TableCell>{plaga.descripcion}</TableCell>
                  <TableCell>
                    {getCultivoNombres(plaga.cultivosAfectados)
                      .split(", ")
                      .map((cultivo) => (
                        <Badge key={cultivo} variant="secondary" className="mr-1">
                          {cultivo}
                        </Badge>
                      ))}
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
                          <DropdownMenuItem onClick={() => openForm(plaga)}>
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
                                  ¿Está seguro de que desea eliminar esta plaga?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente la plaga de sus registros.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(plaga.id)}
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
              {selectedPlaga ? "Editar Plaga" : "Crear Nueva Plaga"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles de la plaga.
            </DialogDescription>
          </DialogHeader>
          <PlagaForm
            plaga={selectedPlaga}
            cultivos={mockCultivos}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedPlaga(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
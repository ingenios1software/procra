"use client";

import { useState } from "react";
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
import { EtapaCultivoForm } from "@/components/agronomia/etapas-cultivo/etapa-cultivo-form";
import type { EtapaCultivo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDataStore } from "@/store/data-store";

export default function EtapasCultivoPage() {
  const { etapasCultivo, cultivos, addEtapaCultivo, updateEtapaCultivo, deleteEtapaCultivo } = useDataStore();

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<EtapaCultivo | null>(null);
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === "admin" || role === "tecnicoCampo";

  const getCultivoNombre = (cultivoId: string) => {
    return cultivos.find((c) => c.id === cultivoId)?.nombre || "N/A";
  };

  const handleSave = (etapaData: EtapaCultivo) => {
    if (selectedEtapa) {
      updateEtapaCultivo(etapaData);
      toast({
        title: "Etapa actualizada",
        description: `La etapa "${etapaData.nombre}" ha sido actualizada.`,
      });
    } else {
      addEtapaCultivo(etapaData);
      toast({
        title: "Etapa creada",
        description: `La etapa "${etapaData.nombre}" ha sido creada.`,
      });
    }
    setFormOpen(false);
    setSelectedEtapa(null);
  };

  const handleDelete = (id: string) => {
    const etapa = etapasCultivo.find((e) => e.id === id);
    deleteEtapaCultivo(id);
    toast({
      variant: "destructive",
      title: "Etapa eliminada",
      description: `La etapa "${etapa?.nombre}" ha sido eliminada.`,
    });
  };

  const openForm = (etapa?: EtapaCultivo) => {
    setSelectedEtapa(etapa || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Etapas Fenológicas del Cultivo"
        description="Gestione las etapas de desarrollo para cada tipo de cultivo."
      >
        {canModify && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nueva Etapa
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Etapas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cultivo</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Código Etapa</TableHead>
                <TableHead>Descripción</TableHead>
                {canModify && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {etapasCultivo.map((etapa) => (
                <TableRow key={etapa.id}>
                  <TableCell>
                    <Badge variant="secondary">{getCultivoNombre(etapa.cultivoId)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{etapa.orden}</TableCell>
                  <TableCell className="font-medium">{etapa.nombre}</TableCell>
                  <TableCell>{etapa.descripcion}</TableCell>
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
                          <DropdownMenuItem onClick={() => openForm(etapa)}>
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
                                  ¿Está seguro de que desea eliminar esta
                                  etapa?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto
                                  eliminará permanentemente la etapa de sus
                                  registros.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(etapa.id)}
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
              {selectedEtapa ? "Editar Etapa" : "Crear Nueva Etapa"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles de la etapa del cultivo.
            </DialogDescription>
          </DialogHeader>
          <EtapaCultivoForm
            etapa={selectedEtapa}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedEtapa(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

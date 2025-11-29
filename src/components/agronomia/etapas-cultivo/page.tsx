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
import type { EtapaCultivo, Cultivo } from "@/lib/types";
import { useUser, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { collection, query, orderBy, doc } from 'firebase/firestore';


export default function EtapasCultivoPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const etapasCultivoQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'etapasCultivo'), orderBy('orden')) : null
  , [firestore]);
  const { data: etapasCultivo, isLoading: isLoadingEtapas } = useCollection<EtapaCultivo>(etapasCultivoQuery);
  
  const cultivosQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null
  , [firestore]);
  const { data: cultivos, isLoading: isLoadingCultivos } = useCollection<Cultivo>(cultivosQuery);

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<EtapaCultivo | null>(null);

  const getCultivoNombre = (cultivoId: string) => {
    return cultivos?.find((c) => c.id === cultivoId)?.nombre || "N/A";
  };

  const handleSave = (etapaData: Omit<EtapaCultivo, 'id'>) => {
    if (!firestore) return;

    if (selectedEtapa) {
      const etapaRef = doc(firestore, "etapasCultivo", selectedEtapa.id);
      updateDocumentNonBlocking(etapaRef, etapaData);
      toast({
        title: "Etapa actualizada",
        description: `La etapa "${etapaData.nombre}" ha sido actualizada.`,
      });
    } else {
      const etapasCultivoCol = collection(firestore, 'etapasCultivo');
      addDocumentNonBlocking(etapasCultivoCol, etapaData);
      toast({
        title: "Etapa creada",
        description: `La etapa "${etapaData.nombre}" ha sido creada.`,
      });
    }
    setFormOpen(false);
    setSelectedEtapa(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const etapa = etapasCultivo?.find((e) => e.id === id);
    const etapaRef = doc(firestore, "etapasCultivo", id);
    deleteDocumentNonBlocking(etapaRef);
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
        {user && (
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
                {user && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoadingEtapas || isLoadingCultivos) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Cargando datos...</TableCell>
                </TableRow>
              )}
              {etapasCultivo?.map((etapa) => (
                <TableRow key={etapa.id}>
                  <TableCell>
                    <Badge variant="secondary">{getCultivoNombre(etapa.cultivoId)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{etapa.orden}</TableCell>
                  <TableCell className="font-medium">{etapa.nombre}</TableCell>
                  <TableCell>{etapa.descripcion}</TableCell>
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

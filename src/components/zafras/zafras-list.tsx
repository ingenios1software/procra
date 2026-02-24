"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDocumentNonBlocking, updateDocumentNonBlocking, useFirestore, useUser } from "@/firebase";
import { ZafraForm } from "./zafra-form";
import type { Zafra } from "@/lib/types";

interface ZafrasListProps {
  initialZafras: Zafra[];
  isLoading: boolean;
}

export function ZafrasList({ initialZafras, isLoading }: ZafrasListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedZafra, setSelectedZafra] = useState<Zafra | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSave = async (
    zafraData: Omit<Zafra, "id" | "fechaFin" | "fechaInicio"> & { fechaInicio: Date; fechaSiembra?: Date }
  ) => {
    if (!firestore) return;

    const dataToSave = {
      ...zafraData,
      fechaInicio: zafraData.fechaInicio.toISOString(),
      fechaSiembra: zafraData.fechaSiembra ? zafraData.fechaSiembra.toISOString() : null,
    };

    if (selectedZafra) {
      updateDocumentNonBlocking(doc(firestore, "zafras", selectedZafra.id), dataToSave);
      toast({ title: "Zafra actualizada" });
    } else {
      const zafrasCol = collection(firestore, "zafras");
      const lastQuery = query(zafrasCol, orderBy("numeroItem", "desc"), limit(1));
      const snapshot = await getDocs(lastQuery);
      let maxNumeroItem = 0;
      if (!snapshot.empty) {
        maxNumeroItem = snapshot.docs[0].data().numeroItem || 0;
      }
      const numeroItem = maxNumeroItem + 1;
      addDocumentNonBlocking(zafrasCol, { ...dataToSave, numeroItem });
      toast({ title: "Zafra creada", description: `Item NÂº ${numeroItem}` });
    }

    setDialogOpen(false);
    setSelectedZafra(null);
  };

  const handleCloseZafra = (id: string) => {
    if (!firestore) return;
    const zafraToUpdate = initialZafras.find((zafra) => zafra.id === id);
    if (!zafraToUpdate) return;
    updateDocumentNonBlocking(doc(firestore, "zafras", id), {
      ...zafraToUpdate,
      estado: "finalizada",
      fechaFin: new Date().toISOString(),
    });
    toast({ title: "Zafra cerrada", description: "La zafra ha sido marcada como finalizada." });
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    const zafra = initialZafras.find((item) => item.id === id);
    await deleteDoc(doc(firestore, "zafras", id));
    toast({
      variant: "destructive",
      title: "Zafra eliminada",
      description: `La zafra "${zafra?.nombre}" ha sido eliminada.`,
    });
  };

  const openDialog = (zafra?: Zafra) => {
    setSelectedZafra(zafra || null);
    setDialogOpen(true);
  };

  const sortedZafras = [...initialZafras].sort((a, b) => (a.numeroItem || 0) - (b.numeroItem || 0));
  const shareSummary = `Total de zafras: ${initialZafras.length}.`;

  return (
    <>
      <PageHeader
        title="Gestion de Zafras"
        description="Planifique, supervise y cierre las campanas agricolas anuales."
      >
        <ReportActions reportTitle="Gestion de Zafras" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Zafra
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Zafras</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item NÂº</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha de Inicio</TableHead>
                  <TableHead>Fecha de Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando zafras...
                    </TableCell>
                  </TableRow>
                )}
                {sortedZafras.map((zafra, index) => (
                  <TableRow key={zafra.id}>
                    <TableCell className="font-medium text-muted-foreground">{zafra.numeroItem || index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/zafras/${zafra.id}`} className="hover:underline text-primary">
                        {zafra.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>{format(new Date(zafra.fechaInicio as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{zafra.fechaFin ? format(new Date(zafra.fechaFin as string), "dd/MM/yyyy") : "N/A"}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn("capitalize", {
                          "bg-green-600 text-primary-foreground": zafra.estado === "en curso",
                          "bg-destructive text-destructive-foreground": zafra.estado === "finalizada",
                          "bg-blue-500 text-white": zafra.estado === "planificada",
                        })}
                      >
                        {zafra.estado}
                      </Badge>
                    </TableCell>
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
                            <DropdownMenuItem onClick={() => openDialog(zafra)}>Editar</DropdownMenuItem>
                            {zafra.estado !== "finalizada" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(event) => event.preventDefault()}
                                    className="text-amber-600 focus:text-amber-700 focus:bg-amber-50"
                                  >
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Cerrar Zafra
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Desea cerrar la zafra?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta accion marcara la zafra como finalizada con la fecha actual.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleCloseZafra(zafra.id)}>
                                      Cerrar Zafra
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="text-destructive">
                                  Eliminar
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Esta seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta accion eliminara la zafra permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(zafra.id)}
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
                {!isLoading && initialZafras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No hay zafras creadas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedZafra ? "Editar Zafra" : "Crear Nueva Zafra"}</DialogTitle>
          </DialogHeader>
          <ZafraForm zafra={selectedZafra} onSubmit={handleSave} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

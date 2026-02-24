"use client";

import Link from "next/link";
import { useState } from "react";
import { collection, doc, getCountFromServer } from "firebase/firestore";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { addDocumentNonBlocking, deleteDocumentNonBlocking, useFirestore, useUser } from "@/firebase";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import type { Parcela } from "@/lib/types";

interface ParcelasListProps {
  parcelas: Parcela[];
  isLoading: boolean;
}

export function ParcelasList({ parcelas, isLoading }: ParcelasListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const handleSave = async (data: Omit<Parcela, "id" | "numeroItem">) => {
    if (!firestore) return;

    const parcelasCol = collection(firestore, "parcelas");
    const snapshot = await getCountFromServer(parcelasCol);
    const numeroItem = snapshot.data().count + 1;

    addDocumentNonBlocking(parcelasCol, { ...data, numeroItem });
    toast({
      title: "Parcela creada",
      description: `La parcela ${data.nombre} (Item NÂº ${numeroItem}) ha sido creada.`,
    });

    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const parcela = parcelas.find((item) => item.id === id);
    deleteDocumentNonBlocking(doc(firestore, "parcelas", id));
    toast({
      variant: "destructive",
      title: "Parcela eliminada",
      description: `La parcela "${parcela?.nombre}" ha sido eliminada.`,
    });
  };

  const shareSummary = `Total de parcelas: ${parcelas.length}.`;

  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Gestione las parcelas de su establecimiento."
      >
        <ReportActions reportTitle="Parcelas" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Parcela
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item NÂº</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Superficie (ha)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Sector</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {parcelas.map((parcela, index) => (
                  <TableRow key={parcela.id}>
                    <TableCell className="font-medium text-muted-foreground">{parcela.numeroItem || index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/parcelas/${parcela.id}`} className="hover:underline text-primary">
                        {parcela.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>{parcela.superficie}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          parcela.estado === "activa"
                            ? "default"
                            : parcela.estado === "en barbecho"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          "capitalize",
                          parcela.estado === "activa" && "bg-green-600 text-white",
                          parcela.estado === "en barbecho" && "bg-yellow-500 text-black",
                          parcela.estado === "inactiva" && "bg-gray-400 text-white"
                        )}
                      >
                        {parcela.estado === "en barbecho" ? "En Barbecho" : parcela.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>{parcela.sector}</TableCell>
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
                            <DropdownMenuItem asChild>
                              <Link href={`/parcelas/${parcela.id}`}>Ver Reporte de Costos</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/parcelas/editar/${parcela.id}`}>Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                  onSelect={(event) => event.preventDefault()}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Esta seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta accion es permanente y eliminara la parcela. No se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(parcela.id)}
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
                {!isLoading && parcelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No hay parcelas. Cree una para empezar.
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
            <DialogTitle>Crear Nueva Parcela</DialogTitle>
            <DialogDescription>Complete los detalles de la nueva parcela.</DialogDescription>
          </DialogHeader>
          <ParcelaForm onSubmit={handleSave} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

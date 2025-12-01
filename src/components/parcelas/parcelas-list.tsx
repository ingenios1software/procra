"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Parcela } from "@/lib/types";
import { useUser, useFirestore, deleteDocumentNonBlocking } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { useToast } from "@/hooks/use-toast";
import { doc } from 'firebase/firestore';


interface ParcelasListProps {
  parcelas: Parcela[];
  isLoading: boolean;
}

export function ParcelasList({ parcelas, isLoading }: ParcelasListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const parcela = parcelas.find(p => p.id === id);
    const parcelaRef = doc(firestore, 'parcelas', id);
    deleteDocumentNonBlocking(parcelaRef);
    toast({
      variant: "destructive",
      title: "Parcela eliminada",
      description: `La parcela "${parcela?.nombre}" ha sido eliminada.`,
    });
  };
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Gestione las parcelas de su establecimiento."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
           {user && (
            <>
              <Button asChild>
                <Link href="/parcelas/crear">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Parcela
                </Link>
              </Button>
            </>
          )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Superficie (ha)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Sector</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando...</TableCell></TableRow>}
              {parcelas.map((parcela) => (
                <TableRow key={parcela.id}>
                  <TableCell className="font-medium">
                     <Link href={`/parcelas/${parcela.id}`} className="hover:underline text-primary">
                      {parcela.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{parcela.superficie}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={parcela.estado === 'activa' ? 'default' : parcela.estado === 'en barbecho' ? 'secondary' : 'outline'}
                      className={cn(
                        'capitalize',
                        parcela.estado === 'activa' && 'bg-green-600 text-white',
                        parcela.estado === 'en barbecho' && 'bg-yellow-500 text-black',
                        parcela.estado === 'inactiva' && 'bg-gray-400 text-white'
                      )}
                    >
                        {parcela.estado === 'en barbecho' ? 'En Barbecho' : parcela.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>{parcela.sector}</TableCell>
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
                        <DropdownMenuItem asChild>
                          <Link href={`/parcelas/editar/${parcela.id}`}>Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={e => e.preventDefault()}>Eliminar</DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción es permanente y eliminará la parcela. No se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(parcela.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
                  <TableCell colSpan={5} className="text-center h-24">No hay parcelas. Cree una para empezar.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

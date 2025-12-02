
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, PowerOff, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ZafraForm } from "./zafra-form";
import type { Zafra } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { format } from "date-fns";
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
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";
import { collection, doc } from "firebase/firestore";

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

  const handleSave = (zafraData: Omit<Zafra, 'id' | 'fechaFin'> & { fechaInicio: Date, fechaSiembra?: Date }) => {
    if (!firestore) return;
    
    const dataToSave = {
        ...zafraData,
        fechaInicio: zafraData.fechaInicio.toISOString(),
        fechaSiembra: zafraData.fechaSiembra ? zafraData.fechaSiembra.toISOString() : null,
    };

    if (selectedZafra) {
      const zafraRef = doc(firestore, 'zafras', selectedZafra.id);
      updateDocumentNonBlocking(zafraRef, dataToSave);
      toast({ title: "Zafra actualizada" });
    } else {
      const zafrasCol = collection(firestore, 'zafras');
      addDocumentNonBlocking(zafrasCol, dataToSave);
      toast({ title: "Zafra creada" });
    }
    setDialogOpen(false);
    setSelectedZafra(null);
  };
  
  const handleCloseZafra = (id: string) => {
    if (!firestore) return;
    const zafraToUpdate = initialZafras.find(z => z.id === id);
    if(zafraToUpdate) {
        const zafraRef = doc(firestore, 'zafras', id);
        updateDocumentNonBlocking(zafraRef, { ...zafraToUpdate, estado: 'finalizada', fechaFin: new Date().toISOString() });
        toast({ title: "Zafra cerrada", description: "La zafra ha sido marcada como finalizada."});
    }
  };

  const openDialog = (zafra?: Zafra) => {
    setSelectedZafra(zafra || null);
    setDialogOpen(true);
  };

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Gestión de Zafras"
        description="Planifique, supervise y cierre las campañas agrícolas anuales."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {user && (
              <Button onClick={() => openDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Zafra
              </Button>
            )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Listado de Zafras</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha de Inicio</TableHead>
                <TableHead>Fecha de Fin</TableHead>
                <TableHead>Estado</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando zafras...</TableCell></TableRow>}
              {initialZafras.map((zafra) => (
                <TableRow key={zafra.id}>
                  <TableCell className="font-medium">{zafra.nombre}</TableCell>
                  <TableCell>{format(new Date(zafra.fechaInicio as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{zafra.fechaFin ? format(new Date(zafra.fechaFin as string), "dd/MM/yyyy") : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge 
                      className={cn('capitalize', {
                        'bg-green-600 text-primary-foreground': zafra.estado === 'en curso',
                        'bg-destructive text-destructive-foreground': zafra.estado === 'finalizada',
                        'bg-blue-500 text-white': zafra.estado === 'planificada'
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
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openDialog(zafra)}>Editar</DropdownMenuItem>
                          {zafra.estado !== 'finalizada' && (
                             <>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-amber-600 focus:text-amber-700 focus:bg-amber-50">
                                       <PowerOff className="mr-2 h-4 w-4" />
                                       Cerrar Zafra
                                     </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Desea cerrar la zafra?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción marcará la zafra como 'finalizada' y registrará la fecha de fin actual. No podrá ser revertida.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleCloseZafra(zafra.id)}>Cerrar Zafra</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                             </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && initialZafras.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-24">No hay zafras creadas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedZafra ? 'Editar Zafra' : 'Crear Nueva Zafra'}</DialogTitle></DialogHeader>
          <ZafraForm zafra={selectedZafra} onSubmit={handleSave} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

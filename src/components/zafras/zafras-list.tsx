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
import { useAuth } from "@/hooks/use-auth";
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

interface ZafrasListProps {
  initialZafras: Zafra[];
  onAdd: (data: Omit<Zafra, 'id'>) => void;
  onUpdate: (data: Zafra) => void;
}

export function ZafrasList({ initialZafras, onAdd, onUpdate }: ZafrasListProps) {
  const [zafras, setZafras] = useState(initialZafras);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedZafra, setSelectedZafra] = useState<Partial<Zafra> | null>(null);
  
  const { user } = useAuth();
  const canModify = user && user.rol === 'admin';

  useEffect(() => {
    setZafras(initialZafras);
    const interval = setInterval(() => {
        setZafras(currentZafras =>
            currentZafras.map(zafra => {
                const today = new Date();
                if (zafra.estado === 'en curso' && zafra.fechaFin && new Date(zafra.fechaFin) < today) {
                    return { ...zafra, estado: 'finalizada' };
                }
                return zafra;
            })
        );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [initialZafras]);

  const handleCreate = (zafraData: Omit<Zafra, 'id'>) => {
    onAdd(zafraData);
    setCreateDialogOpen(false);
  };

  const handleUpdate = (updatedZafra: Omit<Zafra, 'id'>) => {
    if (selectedZafra?.id) {
      onUpdate({ ...selectedZafra, ...updatedZafra, id: selectedZafra.id });
    }
    setEditDialogOpen(false);
    setSelectedZafra(null);
  };
  
  const handleCloseZafra = (id: string) => {
    const zafraToUpdate = zafras.find(z => z.id === id);
    if(zafraToUpdate) {
        onUpdate({ ...zafraToUpdate, estado: 'finalizada', fechaFin: new Date() });
    }
  };

  const openEditDialog = (zafra: Zafra) => {
    setSelectedZafra(zafra);
    setEditDialogOpen(true);
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
            {canModify && (
              <Button onClick={() => setCreateDialogOpen(true)}>
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
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {zafras.map((zafra) => (
                <TableRow key={zafra.id}>
                  <TableCell className="font-medium">{zafra.nombre}</TableCell>
                  <TableCell>{format(new Date(zafra.fechaInicio), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{zafra.fechaFin ? format(new Date(zafra.fechaFin), "dd/MM/yyyy") : 'N/A'}</TableCell>
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
                          <DropdownMenuItem onClick={() => openEditDialog(zafra)}>Editar</DropdownMenuItem>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Nueva Zafra</DialogTitle></DialogHeader>
          <ZafraForm onSubmit={handleCreate} onCancel={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Zafra</DialogTitle></DialogHeader>
          {selectedZafra && <ZafraForm zafra={selectedZafra} onSubmit={handleUpdate} onCancel={() => setEditDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}


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
}

export function ZafrasList({ initialZafras }: ZafrasListProps) {
  const [zafras, setZafras] = useState(initialZafras);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedZafra, setSelectedZafra] = useState<Zafra | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador';

  useEffect(() => {
    const today = new Date();
    const interval = setInterval(() => {
        setZafras(currentZafras =>
            currentZafras.map(zafra => {
                if (zafra.estado === 'en curso' && zafra.fechaFin && new Date(zafra.fechaFin) < today) {
                    return { ...zafra, estado: 'finalizada' };
                }
                return zafra;
            })
        );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleCreate = (zafraData: Zafra) => {
    const newZafra: Zafra = {
      ...zafraData,
      id: `z${zafras.length + 1}`,
      fechaInicio: new Date(zafraData.fechaInicio),
      fechaFin: zafraData.fechaFin ? new Date(zafraData.fechaFin) : undefined
    };
    setZafras(prev => [...prev, newZafra]);
    setCreateDialogOpen(false);
  };

  const handleUpdate = (updatedZafra: Zafra) => {
     const dataToSave = { 
      ...updatedZafra,
      fechaInicio: new Date(updatedZafra.fechaInicio),
      fechaFin: updatedZafra.fechaFin ? new Date(updatedZafra.fechaFin) : undefined
    };
    setZafras(prev => prev.map(z => z.id === dataToSave.id ? dataToSave : z));
    setEditDialogOpen(false);
    setSelectedZafra(null);
  };
  
  const handleCloseZafra = (id: string) => {
    setZafras(prev => prev.map(z => z.id === id ? { ...z, estado: 'finalizada', fechaFin: new Date() } : z));
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
          {selectedZafra && <ZafraForm zafra={selectedZafra} onSubmit={(data) => handleUpdate({ ...selectedZafra, ...data })} onCancel={() => setEditDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

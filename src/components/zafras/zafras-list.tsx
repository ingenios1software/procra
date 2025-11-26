"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, PowerOff } from "lucide-react";
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

  const handleCreate = (zafra: Omit<Zafra, 'id'>) => {
    setZafras(prev => [...prev, { ...zafra, id: `z${prev.length + 1}` }]);
    setCreateDialogOpen(false);
  };

  const handleUpdate = (zafra: Zafra) => {
    setZafras(prev => prev.map(z => z.id === zafra.id ? zafra : z));
    setEditDialogOpen(false);
    setSelectedZafra(null);
  };
  
  const handleCloseZafra = (id: string) => {
    setZafras(prev => prev.map(z => z.id === id ? { ...z, estado: 'finalizada', fechaFin: new Date() } : z));
  };

  const openEditDialog = (zafra: Zafra) => {
    setSelectedZafra(zafra);
    setEditDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Zafras"
        description="Gestione los ciclos de producción o zafras."
      >
        {canModify && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Zafra
          </Button>
        )}
      </PageHeader>
      
      <Card>
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
                  <TableCell>{format(zafra.fechaInicio, "dd/MM/yyyy")}</TableCell>
                  <TableCell>{zafra.fechaFin ? format(zafra.fechaFin, "dd/MM/yyyy") : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={zafra.estado === 'en curso' ? 'default' : zafra.estado === 'finalizada' ? 'destructive' : 'secondary'} className={cn(zafra.estado === 'en curso' && 'bg-green-600')}>{zafra.estado}</Badge>
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
                             <AlertDialog>
                              <AlertDialogTrigger asChild>
                                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}><PowerOff className="mr-2 h-4 w-4" />Cerrar Zafra</DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Desea cerrar la zafra?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción marcará la zafra como finalizada y registrará la fecha de fin. No podrá ser revertida.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCloseZafra(zafra.id)}>Cerrar Zafra</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

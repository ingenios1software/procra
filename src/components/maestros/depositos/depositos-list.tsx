"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Deposito } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc } from "firebase/firestore";
import { DepositoForm } from "./deposito-form";
import { Badge } from "@/components/ui/badge";

interface DepositosListProps {
  initialDepositos: Deposito[];
  isLoading: boolean;
  onDataChange: () => void;
}

export function DepositosList({ initialDepositos, isLoading, onDataChange }: DepositosListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedDeposito, setSelectedDeposito] = useState<Deposito | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSave = useCallback((data: Omit<Deposito, "id">) => {
    if (!firestore) return;

    if (selectedDeposito) {
      const docRef = doc(firestore, 'depositos', selectedDeposito.id);
      updateDocumentNonBlocking(docRef, data);
      toast({ title: "Depósito actualizado" });
    } else {
      const collectionRef = collection(firestore, 'depositos');
      addDocumentNonBlocking(collectionRef, data);
      toast({ title: "Depósito creado" });
    }
    onDataChange();
    setDialogOpen(false);
    setSelectedDeposito(null);
  }, [selectedDeposito, firestore, toast, onDataChange]);

  const toggleActivo = useCallback((deposito: Deposito) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'depositos', deposito.id);
    updateDocumentNonBlocking(docRef, { activo: !deposito.activo });
    toast({ title: `Depósito ${!deposito.activo ? 'activado' : 'desactivado'}` });
    onDataChange();
  }, [firestore, toast, onDataChange]);

  const openDialog = useCallback((deposito?: Deposito) => {
    setSelectedDeposito(deposito || null);
    setDialogOpen(true);
  }, []);

  return (
    <>
      <PageHeader
        title="Maestro de Depósitos"
        description="Gestione los depósitos y almacenes de la empresa."
      >
        {user && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Depósito
          </Button>
        )}
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Depósitos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Sucursal ID</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center">Cargando...</TableCell>
                </TableRow>
              )}
              {initialDepositos.map((deposito) => (
                <TableRow key={deposito.id}>
                  <TableCell className="font-medium">{deposito.nombre}</TableCell>
                  <TableCell>{deposito.sucursalId || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={deposito.activo ? 'default' : 'destructive'} className={deposito.activo ? 'bg-green-600' : ''}>
                      {deposito.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openDialog(deposito)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActivo(deposito)}>
                          {deposito.activo ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && initialDepositos.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No hay depósitos. Puede crear uno nuevo.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog modal={false} open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>{selectedDeposito ? 'Editar Depósito' : 'Crear Nuevo Depósito'}</DialogTitle>
          </DialogHeader>
          <DepositoForm 
            deposito={selectedDeposito} 
            onSubmit={handleSave} 
            onCancel={() => { setDialogOpen(false); setSelectedDeposito(null); }} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

    

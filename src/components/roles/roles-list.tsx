"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "./role-form";
import type { Rol, Permisos } from "@/lib/types";
import { useUser } from "@/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RolesListProps {
  initialRoles: Rol[];
  onSave: (data: Omit<Rol, 'id'>, id?: string) => void;
  onDelete: (id: string) => void;
}

const PermissionsSummary = ({ permisos, soloLectura }: { permisos: Permisos, soloLectura: boolean }) => {
    if (soloLectura) {
        return <Badge variant="secondary">Solo Lectura</Badge>;
    }

    const activePermissions = Object.entries(permisos)
        .filter(([, value]) => value)
        .map(([key]) => key);

    if (activePermissions.length === 0) {
        return <Badge variant="destructive">Sin Permisos</Badge>;
    }

    return (
        <div className="flex flex-wrap gap-1">
            {activePermissions.slice(0, 3).map(perm => (
                <Badge key={perm} variant="outline" className="capitalize">{perm}</Badge>
            ))}
            {activePermissions.length > 3 && (
                <Badge variant="secondary">+{activePermissions.length - 3} más</Badge>
            )}
        </div>
    );
};

export function RolesList({ initialRoles, onSave, onDelete }: RolesListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedRol, setSelectedRol] = useState<Rol | null>(null);
  const { user } = useUser();
  const canModify = user;

  const handleSaveWrapper = (rolData: Omit<Rol, 'id'>) => {
    if (selectedRol) {
      onSave(rolData, selectedRol.id);
    } else {
      onSave(rolData);
    }
    setDialogOpen(false);
    setSelectedRol(null);
  };
  
  const openDialog = (rol?: Rol) => {
    setSelectedRol(rol || null);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Roles y Permisos"
        description="Gestione los roles y permisos de los usuarios del sistema."
      >
        {canModify && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Rol
          </Button>
        )}
      </PageHeader>
      
      {!canModify && (
        <Card className="mb-4 bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
                <p className="text-yellow-800">Solo los administradores pueden gestionar roles.</p>
            </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle>Listado de Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del Rol</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Permisos</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRoles.map((rol) => (
                <TableRow key={rol.id}>
                  <TableCell className="font-medium capitalize">{rol.nombre}</TableCell>
                  <TableCell>{rol.descripcion}</TableCell>
                  <TableCell>
                    <PermissionsSummary permisos={rol.permisos} soloLectura={rol.soloLectura} />
                  </TableCell>
                  {canModify && (
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0" disabled={rol.esSistema}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDialog(rol)}>
                                    Editar
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-destructive"
                                        disabled={rol.esSistema}
                                    >
                                        Eliminar
                                    </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Esta acción no se puede deshacer.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(rol.id)} className="bg-destructive hover:bg-destructive/90">
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
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRol ? 'Editar Rol' : 'Crear Nuevo Rol'}</DialogTitle>
            <DialogDescription>
                Defina el nombre, la descripción y los permisos para este rol.
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            rol={selectedRol}
            onSubmit={handleSaveWrapper}
            onCancel={() => { setDialogOpen(false); setSelectedRol(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

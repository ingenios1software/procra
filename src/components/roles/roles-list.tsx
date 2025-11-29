"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "./role-form";
import type { Rol } from "@/lib/types";
import { useUser } from "@/firebase";

interface RolesListProps {
  initialRoles: Rol[];
}

export function RolesList({ initialRoles }: RolesListProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedRol, setSelectedRol] = useState<Rol | null>(null);
  const { user } = useUser();
  const canModify = user;

  const handleSave = (rolData: Rol) => {
    if (selectedRol) {
      // Update
      setRoles(prev => prev.map(r => r.id === rolData.id ? rolData : r));
    } else {
      // Create
      setRoles(prev => [...prev, { ...rolData, id: `r${prev.length + 1}` }]);
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
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((rol) => (
                <TableRow key={rol.id}>
                  <TableCell className="font-medium capitalize">{rol.nombre.replace(/([A-Z])/g, ' $1')}</TableCell>
                  <TableCell>{rol.descripcion}</TableCell>
                  {canModify && (
                    <TableCell className="text-right">
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => openDialog(rol)}>
                        <span className="sr-only">Editar</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
          </DialogHeader>
          <RoleForm
            rol={selectedRol}
            onSubmit={handleSave}
            onCancel={() => { setDialogOpen(false); setSelectedRol(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

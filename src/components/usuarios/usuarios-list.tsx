
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UsuarioForm } from "./usuario-form";
import type { Usuario, Rol } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

interface UsuariosListProps {
  initialUsuarios: Usuario[];
  roles: Rol[];
  onSave: (data: Omit<Usuario, 'id' | 'rolNombre'>, id?: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

export function UsuariosList({ initialUsuarios, roles, onSave, onDelete, isLoading }: UsuariosListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const { permisos } = useAuth();

  const canModify = permisos.administracion;

  const handleSave = (usuarioData: Omit<Usuario, 'id' | 'rolNombre'>) => {
    if (selectedUsuario) {
      onSave(usuarioData, selectedUsuario.id);
    } else {
      onSave(usuarioData);
    }
    setDialogOpen(false);
    setSelectedUsuario(null);
  };

  const openDialog = (usuario?: Usuario) => {
    setSelectedUsuario(usuario || null);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Usuarios"
        description="Administración de cuentas y roles del sistema."
      >
        {canModify && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Usuario
          </Button>
        )}
      </PageHeader>
  
      {!canModify && (
        <Card className="mb-4 bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-amber-800 font-medium">
              Solo los administradores o supervisores pueden gestionar usuarios.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              )}
              {initialUsuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nombre}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell className="capitalize">
                  {roles.find(r => r.id === usuario.rolId)?.nombre || usuario.rolNombre || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? 'default' : "destructive"}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>

                  {canModify && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                            <span className="sr-only">Editar</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openDialog(usuario)}>
                            Editar
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive"
                              >
                                Eliminar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará al usuario permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(usuario.id)}
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

              {!isLoading && initialUsuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        <Dialog modal={false} open={isDialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>{selectedUsuario ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              Complete los datos del perfil y asigne un rol.
            </DialogDescription>
          </DialogHeader>
          <UsuarioForm
            usuario={selectedUsuario}
            roles={roles}
            onSubmit={handleSave}
            onCancel={() => { setDialogOpen(false); setSelectedUsuario(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

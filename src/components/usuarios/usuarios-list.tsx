"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UsuarioForm, type UsuarioFormPayload } from "./usuario-form";
import type { Usuario, Rol } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

interface UsuariosListProps {
  initialUsuarios: Usuario[];
  roles: Rol[];
  onSave: (data: UsuarioFormPayload, id?: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  companyName?: string;
  activeUsersCount?: number;
  maxUsers?: number | null;
}

export function UsuariosList({
  initialUsuarios,
  roles,
  onSave,
  onDelete,
  isLoading,
  companyName,
  activeUsersCount = 0,
  maxUsers = null,
}: UsuariosListProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const { permisos } = useAuth();

  const canModify = permisos.administracion;
  const hasUserLimit = typeof maxUsers === "number" && Number.isFinite(maxUsers);
  const hasReachedUserLimit = hasUserLimit && activeUsersCount >= maxUsers;
  const tableColSpan = canModify ? 5 : 4;

  const handleSave = (usuarioData: UsuarioFormPayload) => {
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
      <PageHeader title="Gestion de Usuarios" description="Administracion de cuentas y roles del sistema.">
        {canModify && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Usuario
          </Button>
        )}
      </PageHeader>

      {!canModify && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="font-medium text-amber-800">Solo los administradores pueden gestionar usuarios.</p>
          </CardContent>
        </Card>
      )}

      <Card className={hasReachedUserLimit ? "mb-4 border-amber-200 bg-amber-50" : "mb-4"}>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-medium">Cupo de usuarios{companyName ? ` de ${companyName}` : ""}</p>
            <p className="text-sm text-muted-foreground">
              {hasUserLimit
                ? `Usuarios activos: ${activeUsersCount} de ${maxUsers}.`
                : `Usuarios activos: ${activeUsersCount}. Sin limite configurado para el plan.`}
            </p>
            {hasReachedUserLimit && (
              <p className="text-sm font-medium text-amber-800">
                Se alcanzo el limite de usuarios activos. Debe ampliar el cupo o desactivar otro usuario.
              </p>
            )}
          </div>
          {hasUserLimit && (
            <Badge variant={hasReachedUserLimit ? "destructive" : "secondary"}>
              {hasReachedUserLimit ? "Limite alcanzado" : "Cupo disponible"}
            </Badge>
          )}
        </CardContent>
      </Card>

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
                  <TableCell colSpan={tableColSpan} className="h-24 text-center">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              )}
              {initialUsuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nombre}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell className="capitalize">
                    {roles.find((rol) => rol.id === usuario.rolId)?.nombre || usuario.rolNombre || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? "default" : "destructive"}>{usuario.activo ? "Activo" : "Inactivo"}</Badge>
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
                          <DropdownMenuItem onClick={() => openDialog(usuario)}>Editar</DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                Desactivar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar desactivacion</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta accion dejara al usuario sin acceso hasta que vuelva a activarse.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(usuario.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Desactivar
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
                  <TableCell colSpan={tableColSpan} className="h-24 text-center">
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
            <DialogTitle>{selectedUsuario ? "Editar Usuario" : "Crear Nuevo Usuario"}</DialogTitle>
            <DialogDescription>Complete los datos del perfil y asigne un rol.</DialogDescription>
          </DialogHeader>
          <UsuarioForm
            usuario={selectedUsuario}
            roles={roles}
            onSubmit={handleSave}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedUsuario(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

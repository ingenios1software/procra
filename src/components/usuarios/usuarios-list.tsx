"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UsuarioForm } from "./usuario-form";
import type { Usuario, Rol } from "@/lib/types";
import { useAuth, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { collection, doc, query, orderBy } from 'firebase/firestore';


export function UsuariosList() {
  const firestore = useFirestore();

  const usuariosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'usuarios'), orderBy('nombre')) : null, [firestore]);
  const { data: usuarios, isLoading: isLoadingUsuarios } = useCollection<Usuario>(usuariosQuery);
  
  const rolesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'roles')) : null, [firestore]);
  const { data: roles, isLoading: isLoadingRoles } = useCollection<Rol>(rolesQuery);

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin';

  const handleSave = (usuarioData: Omit<Usuario, 'id'>) => {
    if (!firestore) return;
    if (selectedUsuario) {
      const usuarioRef = doc(firestore, 'usuarios', selectedUsuario.id);
      updateDocumentNonBlocking(usuarioRef, usuarioData);
    } else {
      const usuariosCol = collection(firestore, 'usuarios');
      addDocumentNonBlocking(usuariosCol, usuarioData);
    }
    setDialogOpen(false);
    setSelectedUsuario(null);
  };
  
  const openDialog = (usuario?: Usuario) => {
    setSelectedUsuario(usuario || null);
    setDialogOpen(true);
  }

  const isLoading = isLoadingUsuarios || isLoadingRoles;

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
                <p className="text-amber-800 font-medium">Solo los administradores pueden gestionar usuarios.</p>
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
              {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
              {usuarios?.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nombre}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell className="capitalize">{usuario.rol.replace(/([A-Z])/g, ' $1')}</TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? 'default' : "destructive"}>{usuario.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  {canModify && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(usuario)}>
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
            <DialogTitle>{selectedUsuario ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <UsuarioForm
            usuario={selectedUsuario}
            roles={roles || []}
            onSubmit={handleSave}
            onCancel={() => { setDialogOpen(false); setSelectedUsuario(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

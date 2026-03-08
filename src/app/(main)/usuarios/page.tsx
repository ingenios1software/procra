"use client";

import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import type { Rol, Usuario } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { tenantCollection } from "@/lib/tenant";
import { useCallableFunction } from "@/firebase/functions";
import type { UsuarioFormPayload } from "@/components/usuarios/usuario-form";

export default function UsuariosPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { permisos, user } = useAuth();
  const empresaId = user?.empresaId || null;
  const createTenantUser = useCallableFunction<
    { empresaId: string; nombre: string; email: string; password: string; rolId: string; activo: boolean },
    { ok: boolean; uid: string; empresaId: string }
  >("createTenantUser");

  const { data: usuarios, isLoading: loadingUsuarios } = useCollection<Usuario>(
    useMemoFirebase(
      () =>
        firestore && permisos.administracion && empresaId
          ? query(collection(firestore, "usuarios"), where("empresaId", "==", empresaId))
          : null,
      [firestore, permisos.administracion, empresaId]
    )
  );
  const { data: roles, isLoading: loadingRoles } = useCollection<Rol>(
    useMemoFirebase(
      () =>
        firestore && permisos.administracion && empresaId
          ? query(tenantCollection(firestore, empresaId, "roles"))
          : null,
      [firestore, permisos.administracion, empresaId]
    )
  );

  const handleSaveUsuario = async (data: UsuarioFormPayload, id?: string) => {
    if (!firestore || !roles || !empresaId) return;

    const rolAsignado = roles.find((rol) => rol.id === data.rolId);
    if (!rolAsignado) {
      toast({ variant: "destructive", title: "Error", description: "El rol seleccionado no es valido." });
      return;
    }

    const usuarioData = {
      nombre: data.nombre,
      email: data.email,
      rolId: data.rolId,
      activo: data.activo,
      empresaId,
      rolNombre: rolAsignado.nombre,
    };

    if (id) {
      updateDocumentNonBlocking(doc(firestore, "usuarios", id), usuarioData);
      toast({ title: "Usuario actualizado", description: `Los datos de ${usuarioData.nombre} fueron actualizados.` });
      return;
    }

    if (!data.password) {
      toast({
        variant: "destructive",
        title: "Falta la clave inicial",
        description: "Ingrese una clave para el usuario nuevo.",
      });
      return;
    }

    try {
      await createTenantUser({
        empresaId,
        nombre: usuarioData.nombre,
        email: usuarioData.email,
        password: data.password,
        rolId: usuarioData.rolId,
        activo: usuarioData.activo,
      });
      toast({ title: "Usuario creado", description: `El usuario ${usuarioData.nombre} fue registrado correctamente.` });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo crear el usuario",
        description: error?.message || "Error inesperado.",
      });
    }
  };

  const handleDeleteUsuario = (id: string) => {
    if (!firestore) return;
    updateDocumentNonBlocking(doc(firestore, "usuarios", id), { activo: false });
    toast({ variant: "destructive", title: "Usuario desactivado" });
  };

  if (!permisos.administracion) {
    return (
      <>
        <PageHeader title="Acceso Denegado" />
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert />
              Permisos Insuficientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>No tienes los permisos necesarios para acceder a la seccion de usuarios.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <UsuariosList
      initialUsuarios={usuarios || []}
      roles={roles || []}
      onSave={handleSaveUsuario}
      onDelete={handleDeleteUsuario}
      isLoading={loadingUsuarios || loadingRoles}
    />
  );
}

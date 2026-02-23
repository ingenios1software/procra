"use client";

import { RolesList } from "@/components/roles/roles-list";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, doc } from 'firebase/firestore';
import type { Rol } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function RolesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { permisos } = useAuth();
  
  const rolesQuery = useMemoFirebase(
    () => (firestore && permisos.administracion) ? query(collection(firestore, 'roles')) : null,
    [firestore, permisos.administracion]
  );
  const { data: roles, isLoading } = useCollection<Rol>(rolesQuery);

  const handleSave = (rolData: Omit<Rol, 'id'>, id?: string) => {
    if (!firestore) return;

    if (id) {
        updateDocumentNonBlocking(doc(firestore, 'roles', id), rolData);
        toast({ title: "Rol actualizado", description: `El rol "${rolData.nombre}" ha sido actualizado.` });
    } else {
        addDocumentNonBlocking(collection(firestore, 'roles'), rolData);
        toast({ title: "Rol creado", description: `El rol "${rolData.nombre}" ha sido creado.` });
    }
  };

  const handleDelete = (id: string) => {
      if(!firestore) return;
      deleteDocumentNonBlocking(doc(firestore, 'roles', id));
      toast({ variant: "destructive", title: "Rol eliminado" });
  }

  if (isLoading) {
    return <p>Cargando roles...</p>
  }

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
            <p>No tienes los permisos necesarios para acceder a la sección de roles.</p>
          </CardContent>
        </Card>
      </>
    );
  }
  
  return (
    <RolesList 
      initialRoles={roles || []}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

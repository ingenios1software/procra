"use client";

import { RolesList } from "@/components/roles/roles-list";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { doc, query } from "firebase/firestore";
import type { Rol } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTenantSelection } from "@/hooks/use-tenant-selection";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { tenantCollection, tenantDoc } from "@/lib/tenant";

export default function RolesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { permisos } = useAuth();
  const { empresaId } = useTenantSelection();

  const rolesQuery = useMemoFirebase(
    () => (firestore && permisos.administracion && empresaId ? query(tenantCollection(firestore, empresaId, "roles")) : null),
    [firestore, permisos.administracion, empresaId]
  );
  const { data: roles, isLoading } = useCollection<Rol>(rolesQuery);

  const handleSave = (rolData: Omit<Rol, "id">, id?: string) => {
    if (!firestore || !empresaId) return;

    if (id) {
      updateDocumentNonBlocking(tenantDoc(firestore, empresaId, "roles", id), rolData);
      toast({ title: "Rol actualizado", description: `El rol "${rolData.nombre}" fue actualizado.` });
    } else {
      addDocumentNonBlocking(tenantCollection(firestore, empresaId, "roles"), rolData);
      toast({ title: "Rol creado", description: `El rol "${rolData.nombre}" fue creado.` });
    }
  };

  const handleDelete = (id: string) => {
    if (!firestore || !empresaId) return;
    deleteDocumentNonBlocking(tenantDoc(firestore, empresaId, "roles", id));
    toast({ variant: "destructive", title: "Rol eliminado" });
  };

  if (isLoading) {
    return <p>Cargando roles...</p>;
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
            <p>No tienes los permisos necesarios para acceder a la seccion de roles.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return <RolesList initialRoles={roles || []} onSave={handleSave} onDelete={handleDelete} />;
}

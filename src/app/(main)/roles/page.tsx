"use client";

import { RolesList } from "@/components/roles/roles-list";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, doc } from 'firebase/firestore';
import type { Rol } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

export default function RolesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const rolesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'roles')) : null, [firestore]);
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
  
  return (
    <RolesList 
      initialRoles={roles || []}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

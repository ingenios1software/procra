"use client";

import { RolesList } from "@/components/roles/roles-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from 'firebase/firestore';
import type { Rol } from '@/lib/types';

export default function RolesPage() {
  const firestore = useFirestore();
  
  const rolesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'roles')) : null, [firestore]);
  const { data: roles, isLoading } = useCollection<Rol>(rolesQuery);

  if (isLoading) {
    return <p>Cargando roles...</p>
  }
  
  return (
    <RolesList 
      initialRoles={roles || []}
    />
  );
}

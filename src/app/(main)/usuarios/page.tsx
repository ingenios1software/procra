"use client";

import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Usuario, Rol } from '@/lib/types';

export default function UsuariosPage() {
  const firestore = useFirestore();
  const usuariosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'usuarios'), orderBy('nombre')) : null, [firestore]);
  const { data: usuarios, isLoading: isLoadingUsuarios } = useCollection<Usuario>(usuariosQuery);
  
  const rolesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'roles')) : null, [firestore]);
  const { data: roles, isLoading: isLoadingRoles } = useCollection<Rol>(rolesQuery);

  const isLoading = isLoadingUsuarios || isLoadingRoles;

  return (
    <UsuariosList usuarios={usuarios || []} roles={roles || []} isLoading={isLoading} />
  );
}

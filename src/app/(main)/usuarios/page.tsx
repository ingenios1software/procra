"use client";

import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, doc } from 'firebase/firestore';
import type { Rol, Usuario } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

export default function UsuariosPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: usuarios, isLoading: loadingUsuarios } = useCollection<Usuario>(useMemoFirebase(() => firestore ? query(collection(firestore, 'usuarios')) : null, [firestore]));
  const { data: roles, isLoading: loadingRoles } = useCollection<Rol>(useMemoFirebase(() => firestore ? query(collection(firestore, 'roles')) : null, [firestore]));

  const handleSaveUsuario = (usuarioData: Omit<Usuario, 'id'>, id?: string) => {
    if (!firestore) return;

    if (id) {
      const usuarioRef = doc(firestore, 'usuarios', id);
      updateDocumentNonBlocking(usuarioRef, usuarioData);
      toast({ title: "Usuario actualizado", description: `Los datos de ${usuarioData.nombre} han sido actualizados.` });
    } else {
      const usuariosCol = collection(firestore, 'usuarios');
      addDocumentNonBlocking(usuariosCol, usuarioData);
      toast({ title: "Usuario creado", description: `El usuario ${usuarioData.nombre} ha sido registrado.` });
    }
  };
  
  const handleDeleteUsuario = (id: string) => {
    if (!firestore) return;
    const usuarioRef = doc(firestore, 'usuarios', id);
    deleteDocumentNonBlocking(usuarioRef);
    toast({ variant: "destructive", title: "Usuario eliminado" });
  };


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

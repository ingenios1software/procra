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

  const handleSaveUsuario = (data: Omit<Usuario, 'id' | 'rolNombre'>, id?: string) => {
    if (!firestore || !roles) return;

    const rolAsignado = roles.find(r => r.id === data.rolId);
    if (!rolAsignado) {
        toast({ variant: "destructive", title: "Error", description: "El rol seleccionado no es válido." });
        return;
    }
    
    const usuarioData = {
        ...data,
        rolNombre: rolAsignado.nombre,
    };

    if (id) {
      const usuarioRef = doc(firestore, 'usuarios', id);
      updateDocumentNonBlocking(usuarioRef, usuarioData);
      toast({ title: "Usuario actualizado", description: `Los datos de ${usuarioData.nombre} han sido actualizados.` });
    } else {
      // La creación de usuarios en Firebase Auth y Firestore debe ser un proceso coordinado.
      // Por ahora, este formulario solo maneja el documento de Firestore.
      // La lógica para crear el usuario en "Authentication" debería ir aquí.
      const usuariosCol = collection(firestore, 'usuarios');
      addDocumentNonBlocking(usuariosCol, usuarioData);
      toast({ title: "Usuario creado", description: `El usuario ${usuarioData.nombre} ha sido registrado en la base de datos.` });
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

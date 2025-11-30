"use client";

import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { useDataStore } from "@/store/data-store";

export default function UsuariosPage() {
  const { usuarios, roles, addUsuario, updateUsuario } = useDataStore();
  return (
    <UsuariosList 
      initialUsuarios={usuarios}
      roles={roles}
      onAdd={addUsuario}
      onUpdate={updateUsuario}
    />
  );
}

"use client";

import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { useDataStore } from "@/store/data-store";

export default function UsuariosPage() {
  const { usuarios, roles } = useDataStore();
  return (
    <UsuariosList 
      initialUsuarios={usuarios}
      roles={roles}
    />
  );
}

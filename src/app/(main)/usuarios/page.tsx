import { UsuariosList } from "@/components/usuarios/usuarios-list";
import { mockUsuarios, mockRoles } from "@/lib/mock-data";

export default function UsuariosPage() {
  return (
    <UsuariosList 
      initialUsuarios={mockUsuarios}
      roles={mockRoles}
    />
  );
}


"use client";

import { ClientesList } from "@/components/comercial/clientes/clientes-list";
import { mockClientes } from "@/lib/mock-data";

export default function ClientesPage() {
  return (
    <ClientesList 
      initialClientes={mockClientes}
    />
  );
}

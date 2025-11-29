"use client";

import { ClientesList } from "@/components/comercial/clientes/clientes-list";
import { useDataStore } from "@/store/data-store";

export default function ClientesPage() {
  const { clientes } = useDataStore();
  return (
    <ClientesList 
      initialClientes={clientes}
    />
  );
}

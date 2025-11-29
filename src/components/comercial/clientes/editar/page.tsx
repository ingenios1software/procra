"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ClienteForm } from "@/components/comercial/clientes/cliente-form";
import { useDataStore } from "@/store/data-store";
import { notFound } from "next/navigation";

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const { clientes } = useDataStore();
  const cliente = clientes.find(c => c.id === params.id);

  if (!cliente) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Cliente"
        description={`Editando los detalles de ${cliente.nombre}.`}
      />
      <ClienteForm cliente={cliente} />
    </>
  );
}

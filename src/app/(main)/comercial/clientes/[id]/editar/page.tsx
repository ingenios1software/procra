"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ClienteForm } from "@/components/comercial/clientes/cliente-form";
import { useDoc, useMemoFirebase } from "@/firebase";
import { notFound } from "next/navigation";
import type { Cliente } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const tenant = useTenantFirestore();

  const clienteRef = useMemoFirebase(() => tenant.doc("clientes", params.id), [tenant, params.id]);
  const { data: cliente, isLoading } = useDoc<Cliente>(clienteRef);

  if (isLoading) {
    return <div>Cargando cliente...</div>;
  }

  if (!cliente) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Editar Cliente" description={`Editando los detalles de ${cliente.nombre}.`} />
      <ClienteForm cliente={{ ...cliente, id: params.id }} />
    </>
  );
}

"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";
import { notFound, useRouter } from "next/navigation";
import { useDoc, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import type { Proveedor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function EditarProveedorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenantFirestore();

  const proveedorRef = useMemoFirebase(() => tenant.doc("proveedores", params.id), [tenant, params.id]);
  const { data: proveedor, isLoading } = useDoc<Proveedor>(proveedorRef);

  const handleSave = (data: Omit<Proveedor, "id" | "activo">) => {
    const ref = tenant.doc("proveedores", params.id);
    if (!ref || !proveedor) return;
    updateDocumentNonBlocking(ref, {
      ...data,
      activo: proveedor.activo ?? true,
    });
    toast({
      title: "Proveedor actualizado",
      description: `Los datos de "${data.nombre}" fueron actualizados.`,
    });
    router.push("/comercial/proveedores");
  };

  if (isLoading) {
    return <div>Cargando proveedor...</div>;
  }

  if (!proveedor) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Editar Proveedor" description={`Editando los detalles de ${proveedor.nombre}.`} />
      <Card>
        <CardContent className="p-6">
          <ProveedorForm proveedor={{ ...proveedor, id: params.id }} onSubmit={handleSave} onCancel={() => router.push("/comercial/proveedores")} />
        </CardContent>
      </Card>
    </>
  );
}

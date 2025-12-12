"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";
import { notFound, useRouter } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { Proveedor } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export default function EditarProveedorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const proveedorRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'proveedores', params.id) : null
  , [firestore, params.id]);

  const { data: proveedor, isLoading } = useDoc<Proveedor>(proveedorRef);

  const handleSave = (data: Omit<Proveedor, "id">) => {
    if (!firestore) return;
    const proveedorRef = doc(firestore, 'proveedores', params.id);
    updateDocumentNonBlocking(proveedorRef, data);
    toast({
      title: "Proveedor actualizado",
      description: `Los datos de "${data.nombre}" han sido actualizados.`,
    });
    router.push("/comercial/proveedores");
  };

  const handleCancel = () => {
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
      <PageHeader
        title="Editar Proveedor"
        description={`Editando los detalles de ${proveedor.nombre}.`}
      />
      <Card>
        <CardContent className="p-6">
            <ProveedorForm 
                proveedor={{...proveedor, id: params.id}} 
                onSubmit={handleSave}
                onCancel={handleCancel}
            />
        </CardContent>
      </Card>
    </>
  );
}

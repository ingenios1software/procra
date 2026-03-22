"use client";

import { useRouter } from "next/navigation";
import { useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import type { Parcela } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { orderBy } from "firebase/firestore";
import { findDuplicateParcela, sanitizeParcelaDraft } from "@/lib/parcelas";

export default function EditarParcelaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const tenant = useTenantFirestore();
  const { toast } = useToast();
  const { id } = params;

  const parcelaRef = useMemoFirebase(() => tenant.doc("parcelas", id), [tenant, id]);
  const { data: parcela, isLoading } = useDoc<Parcela>(parcelaRef);
  const parcelasQuery = useMemoFirebase(() => tenant.query("parcelas", orderBy("nombre")), [tenant]);
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(parcelasQuery);

  const handleSave = (data: Omit<Parcela, "id" | "numeroItem">) => {
    if (!parcela) return;
    const sanitizedData = sanitizeParcelaDraft(data);
    const { duplicateName, duplicateCode } = findDuplicateParcela(parcelas || [], sanitizedData, parcela.id);

    if (duplicateName || duplicateCode) {
      toast({
        variant: "destructive",
        title: duplicateName ? "Parcela duplicada" : "Codigo duplicado",
        description: duplicateName
          ? `Ya existe una parcela con el nombre "${duplicateName.nombre}".`
          : `El codigo ${sanitizedData.codigo} ya esta asignado a "${duplicateCode?.nombre}".`,
      });
      return;
    }

    const docRef = tenant.doc("parcelas", parcela.id);
    if (!docRef) return;

    updateDocumentNonBlocking(docRef, sanitizedData);
    toast({
      title: "Parcela actualizada",
      description: `La parcela "${sanitizedData.nombre}" ha sido actualizada correctamente.`,
    });
    router.push("/parcelas");
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading || isLoadingParcelas) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p>Cargando datos de la parcela...</p>
      </div>
    );
  }

  if (!parcela) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Parcela no encontrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>La parcela que intenta editar no existe o fue eliminada.</p>
            <Button onClick={() => router.push("/parcelas")}>
              Volver a la lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar Parcela"
        description={`Editando los detalles de ${parcela.nombre}.`}
      />
      <Card>
        <CardContent className="p-6">
          <ParcelaForm
            parcela={{ ...parcela, id }}
            existingParcelas={parcelas || []}
            onSubmit={handleSave}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </>
  );
}

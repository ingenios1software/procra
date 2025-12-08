"use client"

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function CrearCompraPage() {
  return (
    <>
      <PageHeader
        title="Registrar Nueva Compra"
        description="Complete los detalles de la nueva compra de productos o insumos."
      />
      <Card>
        <CardContent className="p-6">
            <p>Formulario de creación de compras en mantenimiento. Estará disponible en breve.</p>
        </CardContent>
      </Card>
    </>
  );
}

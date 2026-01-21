"use client";

import { RecalculatePrices } from "@/components/admin/recalculate-prices";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const { permisos } = useAuth();

  if (!permisos.administracion) {
    return (
        <>
            <PageHeader title="Acceso Denegado" />
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert />
                        Permisos Insuficientes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>No tienes los permisos necesarios para acceder a la sección de administración.</p>
                </CardContent>
            </Card>
        </>
    );
  }

  return (
    <>
      <PageHeader
        title="Herramientas de Administración"
        description="Tareas de mantenimiento y corrección de datos del sistema."
      />
      <div className="grid gap-6">
        <RecalculatePrices />
      </div>
    </>
  );
}

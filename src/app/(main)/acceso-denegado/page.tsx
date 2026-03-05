import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getModuloLabelForPermission, getPermissionForPath } from "@/lib/route-permissions";

type PageProps = {
  searchParams?: {
    from?: string;
  };
};

export default function AccesoDenegadoPage({ searchParams }: PageProps) {
  const fromPath = searchParams?.from || "/dashboard";
  const requiredPermission = getPermissionForPath(fromPath);
  const modulo = getModuloLabelForPermission(requiredPermission);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modulo no habilitado"
        description="No tiene permiso para acceder al modulo solicitado."
      />

      <Card>
        <CardHeader>
          <CardTitle>Acceso denegado</CardTitle>
          <CardDescription>
            Este modulo no esta habilitado para su rol o para la suscripcion de su empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Modulo requerido: <strong>{modulo}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Ruta solicitada: {fromPath}
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/dashboard">Volver al dashboard</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Si necesita acceso, solicite habilitacion al administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

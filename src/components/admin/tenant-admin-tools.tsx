"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCallableError, useCallableFunction } from "@/firebase/functions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTenantSelection } from "@/hooks/use-tenant-selection";
import { isPlatformAdminEmail } from "@/lib/platform-admins";

type CreateTenantResponse = {
  ok: boolean;
  empresaId: string;
  adminUid: string;
  adminEmail: string;
};

type MigrateResponse = {
  ok: boolean;
  empresaId: string;
  migratedDocs: number;
  collections: string[];
};

export function TenantAdminTools() {
  const { user } = useAuth();
  const { empresaId, refreshEmpresas, setEmpresaId } = useTenantSelection();
  const { toast } = useToast();
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [plan, setPlan] = useState("demo");
  const [maxUsuarios, setMaxUsuarios] = useState("3");
  const [isCreating, setIsCreating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const createTenantCompany = useCallableFunction<
    {
      nombreEmpresa: string;
      adminNombre: string;
      adminEmail: string;
      adminPassword: string;
      plan: string;
      maxUsuarios: number;
    },
    CreateTenantResponse
  >("createTenantCompany");
  const migrateLegacyData = useCallableFunction<{ empresaId: string }, MigrateResponse>("migrateLegacyDataToTenant");

  const canCreateCompanies = Boolean(user?.esSuperAdmin || isPlatformAdminEmail(user?.email));
  const canMigrateCurrentCompany = Boolean(empresaId);

  const handleCreate = async () => {
    if (!canCreateCompanies) return;
    if (!nombreEmpresa.trim() || !adminNombre.trim() || !adminEmail.trim() || adminPassword.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Complete empresa, admin, email y una clave de al menos 6 caracteres.",
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTenantCompany({
        nombreEmpresa: nombreEmpresa.trim(),
        adminNombre: adminNombre.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword: adminPassword.trim(),
        plan,
        maxUsuarios: Number(maxUsuarios) || 3,
      });
      const payload = result.data;
      toast({
        title: "Empresa creada",
        description: `Se creo ${payload.empresaId} con el admin ${payload.adminEmail}.`,
      });
      refreshEmpresas();
      setEmpresaId(payload.empresaId);
      setNombreEmpresa("");
      setAdminNombre("");
      setAdminEmail("");
      setAdminPassword("");
      setPlan("demo");
      setMaxUsuarios("3");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo crear la empresa",
        description: formatCallableError(error),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleMigrate = async () => {
    if (!empresaId) return;

    setIsMigrating(true);
    try {
      const result = await migrateLegacyData({ empresaId });
      toast({
        title: "Migracion completada",
        description: `Se copiaron ${result.data.migratedDocs} documentos a la empresa actual.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo migrar la data",
        description: formatCallableError(error),
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="grid gap-6">
      {canCreateCompanies && (
        <Card>
          <CardHeader>
            <CardTitle>Alta de Cliente</CardTitle>
            <CardDescription>Crea una empresa nueva, sus roles base, maestros minimos y el usuario administrador inicial.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Empresa</Label>
              <Input id="tenant-name" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-plan">Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="tenant-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-admin-name">Administrador</Label>
              <Input id="tenant-admin-name" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-max-users">Maximo de usuarios</Label>
              <Input id="tenant-max-users" value={maxUsuarios} onChange={(e) => setMaxUsuarios(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-admin-email">Email admin</Label>
              <Input id="tenant-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-admin-password">Clave inicial</Label>
              <Input
                id="tenant-admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creando..." : "Crear Empresa Cliente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canMigrateCurrentCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Migrar Data Legacy</CardTitle>
            <CardDescription>
              Copia los registros top-level existentes al espacio aislado de la empresa actual para mantener la operacion sin mezclar clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Empresa actual: {empresaId}</p>
            <Button variant="outline" onClick={handleMigrate} disabled={isMigrating}>
              {isMigrating ? "Migrando..." : "Migrar Data a Mi Empresa"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

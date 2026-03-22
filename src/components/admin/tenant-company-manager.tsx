"use client";

import { useMemo, useState } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { Building2, Loader2, Power, Trash2 } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { formatCallableError, useCallableFunction } from "@/firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTenantSelection } from "@/hooks/use-tenant-selection";
import { isPlatformAdminEmail } from "@/lib/platform-admins";
import type { EmpresaSaaS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ToggleCompanyResponse = {
  ok: boolean;
  empresaId: string;
  activo: boolean;
  affectedUsers: number;
};

type DeleteCompanyResponse = {
  ok: boolean;
  empresaId: string;
  deletedDocs: number;
  deletedUsers: number;
  preservedUsers: number;
  collections: string[];
};

export function TenantCompanyManager() {
  const firestore = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const { empresaId, setEmpresaId, refreshEmpresas } = useTenantSelection();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<EmpresaSaaS | null>(null);

  const canManageCompanies = Boolean(user?.esSuperAdmin || isPlatformAdminEmail(user?.email));

  const companiesQuery = useMemoFirebase(
    () => (firestore && canManageCompanies ? query(collection(firestore, "empresas"), orderBy("nombre")) : null),
    [canManageCompanies, firestore]
  );
  const { data: companies, isLoading, forceRefetch } = useCollection<EmpresaSaaS>(companiesQuery);

  const setTenantCompanyActive = useCallableFunction<{ empresaId: string; activo: boolean }, ToggleCompanyResponse>(
    "setTenantCompanyActive"
  );
  const deleteTenantCompany = useCallableFunction<{ empresaId: string }, DeleteCompanyResponse>("deleteTenantCompany");

  const sortedCompanies = useMemo(
    () =>
      [...(companies || [])].sort((left, right) =>
        (left.nombre || "").localeCompare(right.nombre || "", "es", { sensitivity: "base" })
      ),
    [companies]
  );

  const refreshAll = async () => {
    forceRefetch();
    refreshEmpresas();
  };

  const handleToggleActive = async (company: EmpresaSaaS) => {
    setPendingAction(`toggle:${company.id}`);
    try {
      const result = await setTenantCompanyActive({ empresaId: company.id, activo: !company.activo });
      await refreshAll();
      toast({
        title: result.data.activo ? "Empresa activada" : "Empresa desactivada",
        description: `${company.nombre} actualizo su estado y se sincronizaron ${result.data.affectedUsers} usuarios.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la empresa",
        description: formatCallableError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;

    setPendingAction(`delete:${companyToDelete.id}`);
    try {
      const result = await deleteTenantCompany({ empresaId: companyToDelete.id });
      await refreshAll();
      toast({
        title: "Empresa eliminada",
        description: `Se eliminaron ${result.data.deletedDocs} documentos tenant y ${result.data.deletedUsers} usuarios de ${companyToDelete.nombre}.`,
      });
      setCompanyToDelete(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar la empresa",
        description: formatCallableError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (!canManageCompanies) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Empresas Cliente</CardTitle>
          <CardDescription>
            Administre las empresas que usan el sistema. Puede seleccionarlas, activarlas o eliminarlas con limpieza de datos tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table resizable className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Suscripcion</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Demo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Cargando empresas...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && sortedCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No hay empresas cliente registradas.
                  </TableCell>
                </TableRow>
              )}
              {sortedCompanies.map((company) => {
                const isCurrent = empresaId === company.id;
                const toggleBusy = pendingAction === `toggle:${company.id}`;
                const deleteBusy = pendingAction === `delete:${company.id}`;

                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium">{company.nombre}</span>
                          <span className="text-xs text-muted-foreground">{company.id}</span>
                        </div>
                        {isCurrent && <Badge variant="secondary">Actual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="uppercase">{company.suscripcion?.plan || "N/A"}</TableCell>
                    <TableCell>{company.suscripcion?.estado || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={company.activo ? "default" : "destructive"}>
                        {company.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>{company.perfil?.email || company.perfil?.contacto || "N/A"}</TableCell>
                    <TableCell>{company.demo?.habilitado ? "Si" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEmpresaId(company.id)} disabled={isCurrent}>
                          Seleccionar
                        </Button>
                        <Button
                          variant={company.activo ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleToggleActive(company)}
                          disabled={toggleBusy || deleteBusy}
                        >
                          {toggleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                          {company.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCompanyToDelete(company)}
                          disabled={toggleBusy || deleteBusy}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(companyToDelete)} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar empresa cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {companyToDelete
                ? `Se eliminara ${companyToDelete.nombre} junto con sus usuarios y datos tenant. Esta accion no se puede deshacer.`
                : "Esta accion no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction?.startsWith("delete:")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pendingAction?.startsWith("delete:")}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pendingAction?.startsWith("delete:") ? "Eliminando..." : "Eliminar empresa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

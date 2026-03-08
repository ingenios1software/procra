"use client";

import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantSelection } from "@/hooks/use-tenant-selection";

export function TenantSwitcher() {
  const { empresaId, empresas, isLoading, canSelectEmpresa, setEmpresaId } = useTenantSelection();

  if (!canSelectEmpresa) return null;

  return (
    <div className="min-w-[240px] max-w-[360px] flex-1 md:flex-initial">
      <Select value={empresaId || undefined} onValueChange={setEmpresaId} disabled={isLoading || empresas.length === 0}>
        <SelectTrigger className="w-full">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder={isLoading ? "Cargando empresas..." : "Seleccionar empresa"} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {empresas.map((empresa) => (
            <SelectItem key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

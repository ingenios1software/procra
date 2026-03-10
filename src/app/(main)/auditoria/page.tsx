"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

type AuditStatus = "ok" | "forbidden" | "unknown" | "error";
type AuditIntent = "stock" | "estado" | "costo" | "modulo" | "unknown";

type AssistantAudit = {
  id: string;
  prompt?: string;
  promptNormalizado?: string;
  intentType?: AuditIntent;
  term?: string | null;
  status?: AuditStatus;
  durationMs?: number;
  responsePreview?: string | null;
  errorMessage?: string | null;
  createdAt?: unknown;
  user?: {
    id?: string | null;
    nombre?: string | null;
    email?: string | null;
    rol?: string | null;
  };
};

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "ok", label: "Exitosas" },
  { value: "forbidden", label: "Denegadas" },
  { value: "unknown", label: "No entendidas" },
  { value: "error", label: "Con error" },
] as const;

const INTENT_OPTIONS = [
  { value: "todos", label: "Todas" },
  { value: "stock", label: "Stock" },
  { value: "estado", label: "Estado de cuenta" },
  { value: "costo", label: "Costo parcela" },
  { value: "modulo", label: "Modulo / informe" },
  { value: "unknown", label: "Desconocida" },
] as const;

const RANGE_OPTIONS = [
  { value: "todos", label: "Todo" },
  { value: "hoy", label: "Hoy" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
type IntentFilter = (typeof INTENT_OPTIONS)[number]["value"];
type RangeFilter = (typeof RANGE_OPTIONS)[number]["value"];

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      const parsed = maybeTimestamp.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof maybeTimestamp.seconds === "number") {
      const parsed = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function getStatusClassName(status?: AuditStatus): string {
  if (status === "ok") return "bg-green-600 text-white";
  if (status === "forbidden") return "bg-amber-600 text-white";
  if (status === "unknown") return "bg-slate-500 text-white";
  if (status === "error") return "bg-red-600 text-white";
  return "bg-muted text-foreground";
}

function getStatusLabel(status?: AuditStatus): string {
  if (status === "ok") return "Exitosa";
  if (status === "forbidden") return "Denegada";
  if (status === "unknown") return "No entendida";
  if (status === "error") return "Error";
  return "N/A";
}

function getIntentLabel(intent?: AuditIntent): string {
  if (intent === "stock") return "Stock";
  if (intent === "estado") return "Estado cuenta";
  if (intent === "costo") return "Costo parcela";
  if (intent === "modulo") return "Modulo / informe";
  if (intent === "unknown") return "Desconocida";
  return "N/A";
}

function passesRangeFilter(date: Date | null, range: RangeFilter): boolean {
  if (range === "todos") return true;
  if (!date) return false;

  const now = new Date();
  if (range === "hoy") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  const days = Number(range);
  if (!Number.isFinite(days)) return true;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return date >= from;
}

export default function AuditoriaPage() {
  const tenant = useTenantFirestore();
  const { permisos, isAuthLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("todos");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("7");

  const { data: auditoria, isLoading } = useCollection<AssistantAudit>(
    useMemoFirebase(() => tenant.collection("auditoriaAsistente"), [tenant])
  );

  const rows = useMemo(() => {
    return (auditoria || [])
      .map((item) => ({
        ...item,
        createdAtDate: toDateSafe(item.createdAt),
      }))
      .sort((a, b) => {
        const aTime = a.createdAtDate?.getTime() ?? 0;
        const bTime = b.createdAtDate?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [auditoria]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (intentFilter !== "todos" && item.intentType !== intentFilter) return false;
      if (!passesRangeFilter(item.createdAtDate, rangeFilter)) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        item.prompt || "",
        item.promptNormalizado || "",
        item.user?.nombre || "",
        item.user?.email || "",
        item.user?.rol || "",
        item.responsePreview || "",
        item.errorMessage || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [intentFilter, rangeFilter, rows, search, statusFilter]);

  const resumen = useMemo(() => {
    const total = filteredRows.length;
    const ok = filteredRows.filter((item) => item.status === "ok").length;
    const forbidden = filteredRows.filter((item) => item.status === "forbidden").length;
    const unknown = filteredRows.filter((item) => item.status === "unknown").length;
    const error = filteredRows.filter((item) => item.status === "error").length;
    const avgDurationMs =
      total > 0
        ? Math.round(filteredRows.reduce((acc, item) => acc + (Number(item.durationMs) || 0), 0) / total)
        : 0;
    return { total, ok, forbidden, unknown, error, avgDurationMs };
  }, [filteredRows]);

  const shareSummary = `Consultas: ${resumen.total} | Exitosas: ${resumen.ok} | Denegadas: ${resumen.forbidden} | Error: ${resumen.error} | Promedio: ${resumen.avgDurationMs} ms.`;

  if (isAuthLoading) {
    return <p>Cargando auditoria...</p>;
  }

  if (!permisos.administracion) {
    return (
      <>
        <PageHeader
          title="Registro de Auditoria"
          description="Revise los registros de actividad del asistente."
        />
        <Card>
          <CardContent className="p-6">
            <p>No tiene permisos para acceder al modulo de auditoria.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Registro de Auditoria"
        description="Revise las consultas del asistente operativo por usuario, intencion y estado."
      >
        <ReportActions reportTitle="Auditoria del Asistente" reportSummary={shareSummary} />
      </PageHeader>

      <div id="pdf-area" className="print-area space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total consultas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{resumen.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Exitosas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-green-700">{resumen.ok}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Denegadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-amber-700">{resumen.forbidden}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">No entendidas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-700">{resumen.unknown}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Duracion promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{resumen.avgDurationMs} ms</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4">
            <CardTitle>Filtros</CardTitle>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por consulta, usuario o error..."
              />
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={intentFilter} onValueChange={(value) => setIntentFilter(value as IntentFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Intencion" />
                </SelectTrigger>
                <SelectContent>
                  {INTENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rangeFilter} onValueChange={(value) => setRangeFilter(value as RangeFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Intencion</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Duracion</TableHead>
                  <TableHead>Consulta</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Cargando registros...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  filteredRows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.createdAtDate ? format(item.createdAtDate, "dd/MM/yyyy HH:mm:ss") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[180px]">
                          <p className="truncate font-medium">{item.user?.nombre || "N/A"}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.user?.email || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{item.user?.rol || "N/A"}</TableCell>
                      <TableCell>{getIntentLabel(item.intentType)}</TableCell>
                      <TableCell>
                        <Badge className={cn(getStatusClassName(item.status))}>{getStatusLabel(item.status)}</Badge>
                      </TableCell>
                      <TableCell>{Number(item.durationMs) || 0} ms</TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate" title={item.prompt || ""}>
                          {item.prompt || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p
                          className="truncate text-sm text-muted-foreground"
                          title={item.errorMessage || item.responsePreview || ""}
                        >
                          {item.errorMessage || item.responsePreview || "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}

                {!isLoading && filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No hay registros para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

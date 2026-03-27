"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Database, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { buildDnitSearchText, formatDnitDocument, getDnitPrimaryName, normalizeDnitSearchText } from "@/lib/dnit";
import type { DnitCacheRecord } from "@/lib/types";

type DnitCacheRow = DnitCacheRecord & {
  id: string;
  lastActivity: Date | null;
};

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

function formatDateTime(value: unknown): string {
  const date = toDateSafe(value);
  return date ? format(date, "dd/MM/yyyy HH:mm") : "N/A";
}

export default function ConfiguracionDnitPage() {
  const tenant = useTenantFirestore();
  const { permisos, isAuthLoading } = useAuth();
  const { toast } = useToast();
  const canManage = permisos.administracion;
  const [search, setSearch] = useState("");
  const [editingRecord, setEditingRecord] = useState<DnitCacheRow | null>(null);
  const [alias, setAlias] = useState("");
  const [notas, setNotas] = useState("");

  const cacheQuery = useMemoFirebase(
    () => (canManage && tenant.isReady ? tenant.collection("dnitContribuyentes") : null),
    [canManage, tenant]
  );
  const { data: records, isLoading } = useCollection<DnitCacheRecord>(cacheQuery);

  useEffect(() => {
    if (!editingRecord) {
      setAlias("");
      setNotas("");
      return;
    }

    setAlias(editingRecord.alias || "");
    setNotas(editingRecord.notas || "");
  }, [editingRecord]);

  const rows = useMemo<DnitCacheRow[]>(() => {
    return [...(records || [])]
      .map((record) => ({
        ...record,
        lastActivity: toDateSafe(record.actualizadoEn || record.consultadoEn),
      }))
      .sort((left, right) => (right.lastActivity?.getTime() || 0) - (left.lastActivity?.getTime() || 0));
  }, [records]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeDnitSearchText(search);
    if (!normalizedSearch) return rows;

    return rows.filter((row) => (row.searchText || buildDnitSearchText(row)).includes(normalizedSearch));
  }, [rows, search]);

  const summary = useMemo(() => {
    const total = rows.length;
    const withAlias = rows.filter((row) => row.alias?.trim()).length;
    const active = rows.filter((row) => row.estado?.trim()).length;
    const lastSync = rows[0]?.actualizadoEn || rows[0]?.consultadoEn || null;
    return { total, withAlias, active, lastSync };
  }, [rows]);

  const handleSave = () => {
    if (!editingRecord) return;
    const docRef = tenant.doc("dnitContribuyentes", editingRecord.id);
    if (!docRef) return;

    const nextAlias = alias.trim();
    const nextNotas = notas.trim();
    updateDocumentNonBlocking(docRef, {
      alias: nextAlias,
      notas: nextNotas,
      searchText: buildDnitSearchText({
        ...editingRecord,
        alias: nextAlias,
        notas: nextNotas,
      }),
      actualizadoEn: new Date().toISOString(),
    });
    toast({
      title: "Registro DNIT actualizado",
      description: `Se guardaron las notas para ${formatDnitDocument(editingRecord)}.`,
    });
    setEditingRecord(null);
  };

  const handleDelete = (id: string, label: string) => {
    const docRef = tenant.doc("dnitContribuyentes", id);
    if (!docRef) return;

    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Registro eliminado",
      description: `Se elimino ${label} de la cache DNIT.`,
    });
  };

  const handleClearAll = () => {
    filteredRows.forEach((row) => {
      const docRef = tenant.doc("dnitContribuyentes", row.id);
      if (docRef) deleteDocumentNonBlocking(docRef);
    });
    toast({
      title: "Cache DNIT limpiada",
      description:
        filteredRows.length === rows.length
          ? "Se solicitaron eliminar todos los registros visibles."
          : `Se solicitaron eliminar ${filteredRows.length} registros filtrados.`,
    });
  };

  if (isAuthLoading) {
    return <p>Cargando cache DNIT...</p>;
  }

  if (!canManage) {
    return (
      <>
        <PageHeader
          title="Cache DNIT"
          description="Administre los contribuyentes consultados desde la integracion DNIT."
        />
        <Card>
          <CardContent className="p-6">
            <p>No tiene permisos para administrar la cache DNIT.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cache DNIT"
        description="Revise, etiquete y limpie los contribuyentes guardados para la empresa activa."
      >
        <Button asChild variant="outline">
          <Link href="/configuracion/comercial">Volver a Empresa / SaaS</Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {!tenant.isReady && (
          <Card>
            <CardContent className="p-6">
              <p>Seleccione una empresa activa para administrar su cache DNIT.</p>
            </CardContent>
          </Card>
        )}

        {tenant.isReady && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Registros</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Con alias</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.withAlias}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Con estado DNIT</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.active}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ultima actualizacion</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{summary.lastSync ? formatDateTime(summary.lastSync) : "N/A"}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Contribuyentes guardados
                    </CardTitle>
                    <CardDescription>
                      Busque por nombre, alias, razon social, documento o notas internas.
                    </CardDescription>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar en cache DNIT..."
                      className="md:w-80"
                    />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={!filteredRows.length}>
                          Limpiar cache visible
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpiar cache DNIT</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta accion eliminara {filteredRows.length} registro(s) visibles de la cache de la empresa
                            activa. Puede volver a consultarlos desde DNIT cuando lo necesite.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAll}>Eliminar registros</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table resizable className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Nombre DNIT</TableHead>
                      <TableHead>Alias</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Actualizado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={7}>Cargando cache DNIT...</TableCell>
                      </TableRow>
                    )}
                    {!isLoading && !filteredRows.length && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          {search.trim() ? (
                            "No hay coincidencias para ese criterio."
                          ) : (
                            <div className="space-y-1 py-2">
                              <p>Todavia no hay contribuyentes guardados en la cache DNIT.</p>
                              <p className="text-xs text-muted-foreground">
                                Esta lista se llena cuando consulta un RUC desde Empresa / Clientes / Proveedores y aplica
                                los datos DNIT para la empresa activa.
                              </p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{formatDnitDocument(row)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{getDnitPrimaryName(row) || row.razonSocial}</p>
                            {row.nombreComercial && row.nombreComercial !== row.razonSocial && (
                              <p className="text-xs text-muted-foreground">Razon social: {row.razonSocial}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{row.alias?.trim() || "N/A"}</TableCell>
                        <TableCell>{row.estado ? <Badge variant="outline">{row.estado}</Badge> : "N/A"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{row.notas?.trim() || "N/A"}</TableCell>
                        <TableCell>{formatDateTime(row.actualizadoEn || row.consultadoEn)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingRecord(row)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar registro DNIT</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminara {formatDnitDocument(row)} de la cache local de esta empresa.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(row.id, formatDnitDocument(row))}
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={Boolean(editingRecord)} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>Editar registro DNIT</DialogTitle>
            <DialogDescription>
              Agregue un alias o notas internas para encontrar mas rapido este contribuyente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{editingRecord ? getDnitPrimaryName(editingRecord) : ""}</p>
              <p className="text-sm text-muted-foreground">
                {editingRecord ? formatDnitDocument(editingRecord) : ""}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Alias</label>
              <Input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Cliente premium, proveedor historico..." />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas internas</label>
              <Textarea
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                placeholder="Observaciones para el equipo administrativo o comercial."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

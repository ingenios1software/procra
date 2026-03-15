"use client";

import { useMemo, useState } from "react";
import { deleteDoc, doc, writeBatch } from "firebase/firestore";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import type { EventoTipoBase, TipoEvento } from "@/lib/types";
import {
  DEFAULT_TIPOS_EVENTO_SEEDS,
  EVENTO_TIPO_BASE_OPTIONS,
  normalizeTipoEventoText,
  getTipoBaseLabel,
  sortTiposEvento,
} from "@/lib/eventos/tipos";

type TipoEventoFormState = {
  nombre: string;
  tipoBase: EventoTipoBase;
  descripcion: string;
  activo: "true" | "false";
  orden: string;
};

const DEFAULT_FORM: TipoEventoFormState = {
  nombre: "",
  tipoBase: "aplicacion",
  descripcion: "",
  activo: "true",
  orden: "1",
};

export default function TiposEventoPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { toast } = useToast();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoEvento | null>(null);
  const [form, setForm] = useState<TipoEventoFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [tipoToDelete, setTipoToDelete] = useState<TipoEvento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tiposQuery = useMemoFirebase(() => tenant.collection("tiposEvento"), [tenant]);
  const { data: tiposEvento, isLoading, forceRefetch } = useCollection<TipoEvento>(tiposQuery);

  const tiposOrdenados = useMemo(() => sortTiposEvento(tiposEvento || []), [tiposEvento]);

  const nextOrder = useMemo(
    () => Math.max(0, ...tiposOrdenados.map((tipo) => Number(tipo.orden) || 0)) + 1,
    [tiposOrdenados]
  );

  const openCreateDialog = () => {
    setSelectedTipo(null);
    setForm({
      ...DEFAULT_FORM,
      orden: String(nextOrder),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (tipo: TipoEvento) => {
    setSelectedTipo(tipo);
    setForm({
      nombre: tipo.nombre || "",
      tipoBase: tipo.tipoBase || "aplicacion",
      descripcion: tipo.descripcion || "",
      activo: tipo.activo === false ? "false" : "true",
      orden: String(tipo.orden || nextOrder),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedTipo(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    const tiposCol = tenant.collection("tiposEvento");
    if (!firestore || !tiposCol) return;

    const nombre = form.nombre.trim().replace(/\s+/g, " ");
    const descripcion = form.descripcion.trim().replace(/\s+/g, " ");
    if (!nombre) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
        description: "Ingrese un nombre para el tipo de evento.",
      });
      return;
    }

    const duplicate = tiposOrdenados.find(
      (tipo) =>
        tipo.id !== selectedTipo?.id &&
        normalizeTipoEventoText(tipo.nombre) === normalizeTipoEventoText(nombre)
    );

    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Tipo duplicado",
        description: `Ya existe un tipo de evento llamado "${duplicate.nombre}".`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Omit<TipoEvento, "id"> = {
        nombre,
        tipoBase: form.tipoBase,
        descripcion: descripcion || undefined,
        activo: form.activo === "true",
        orden: Number(form.orden) || nextOrder,
        esSistema: selectedTipo?.esSistema || false,
      };

      const batch = writeBatch(firestore);
      if (selectedTipo) {
        const tipoRef = tenant.doc("tiposEvento", selectedTipo.id);
        if (!tipoRef) return;
        batch.update(tipoRef, payload);
      } else {
        batch.set(doc(tiposCol), payload);
      }

      await batch.commit();
      toast({ title: selectedTipo ? "Tipo actualizado" : "Tipo creado" });
      closeDialog();
      forceRefetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    const tiposCol = tenant.collection("tiposEvento");
    if (!firestore || !tiposCol) return;

    setIsSeeding(true);
    try {
      const normalizedNames = new Set((tiposEvento || []).map((tipo) => normalizeTipoEventoText(tipo.nombre)));
      const existingIds = new Set((tiposEvento || []).map((tipo) => tipo.id));
      const pendingSeeds = DEFAULT_TIPOS_EVENTO_SEEDS.filter(
        (seed) => !existingIds.has(seed.id) && !normalizedNames.has(normalizeTipoEventoText(seed.nombre))
      );

      if (pendingSeeds.length === 0) {
        toast({
          title: "Sin cambios",
          description: "Los tipos base ya estan cargados en el maestro.",
        });
        return;
      }

      const batch = writeBatch(firestore);
      pendingSeeds.forEach((seed) => {
        batch.set(doc(tiposCol, seed.id), seed);
      });
      await batch.commit();

      toast({
        title: "Tipos base cargados",
        description: `Se agregaron ${pendingSeeds.length} tipos base.`,
      });
      forceRefetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudieron cargar los tipos base",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const toggleActive = async (tipo: TipoEvento) => {
    if (!firestore) return;
    try {
      const tipoRef = tenant.doc("tiposEvento", tipo.id);
      if (!tipoRef) return;
      await writeBatch(firestore)
        .update(tipoRef, { activo: !tipo.activo })
        .commit();
      toast({ title: !tipo.activo ? "Tipo activado" : "Tipo desactivado" });
      forceRefetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar el estado",
        description: error?.message || "Error inesperado.",
      });
    }
  };

  const handleDelete = async () => {
    if (!tipoToDelete) return;
    const tipoRef = tenant.doc("tiposEvento", tipoToDelete.id);
    if (!tipoRef) return;

    setIsDeleting(true);
    try {
      await deleteDoc(tipoRef);
      toast({ title: "Tipo eliminado" });
      forceRefetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsDeleting(false);
      setTipoToDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Maestro de Tipos de Evento"
        description="Defina nombres de evento visibles para el cliente y asocielos a un tipo base del sistema."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults} disabled={isSeeding}>
            {isSeeding ? "Cargando base..." : "Cargar Tipos Base"}
          </Button>
          <Button onClick={openCreateDialog}>Nuevo Tipo</Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de Evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El nombre es lo que vera el cliente en el formulario. El tipo base define el comportamiento interno del
            sistema para costos, stock, siembra y cosecha. Aunque todavia no cargue nada aqui, el sistema mantiene
            disponibles los tipos base por defecto.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo base</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                tiposOrdenados.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell>{tipo.orden || "-"}</TableCell>
                    <TableCell className="font-medium">{tipo.nombre}</TableCell>
                    <TableCell>{getTipoBaseLabel(tipo.tipoBase)}</TableCell>
                    <TableCell>{tipo.descripcion || "-"}</TableCell>
                    <TableCell>
                      {tipo.activo ? (
                        <Badge className="bg-green-600">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(tipo)}>
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(tipo)}>
                          {tipo.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setTipoToDelete(tipo)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && tiposOrdenados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center">
                    No hay tipos de evento configurados. Puede cargar la base o crear uno nuevo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog modal={false} open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent draggable>
          <DialogHeader>
            <DialogTitle>{selectedTipo ? "Editar Tipo de Evento" : "Nuevo Tipo de Evento"}</DialogTitle>
            <DialogDescription>
              Elija un nombre visible y el tipo base que define el comportamiento del evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre visible</Label>
              <Input
                value={form.nombre}
                onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Ej: Aplicacion Fungicida"
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo base</Label>
              <Select
                value={form.tipoBase}
                onValueChange={(value) => setForm((prev) => ({ ...prev, tipoBase: value as EventoTipoBase }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTO_TIPO_BASE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Descripcion</Label>
              <Input
                value={form.descripcion}
                onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1">
              <Label>Orden</Label>
              <Input
                type="number"
                value={form.orden}
                onChange={(event) => setForm((prev) => ({ ...prev, orden: event.target.value }))}
                placeholder="Ej: 10"
              />
            </div>

            <div className="space-y-1">
              <Label>Estado</Label>
              <Select
                value={form.activo}
                onValueChange={(value) => setForm((prev) => ({ ...prev, activo: value as "true" | "false" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activo</SelectItem>
                  <SelectItem value="false">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tipoToDelete} onOpenChange={(open) => !open && setTipoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de evento</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar este tipo no borra eventos ya registrados, pero dejara de estar disponible en el formulario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { doc, orderBy, writeBatch } from "firebase/firestore";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useMemoFirebase } from "@/firebase";
import type { Moneda } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

type MonedaFormState = {
  codigo: string;
  descripcion: string;
  tasaCambio: string;
  esMonedaBase: "true" | "false";
};

const DEFAULT_FORM: MonedaFormState = {
  codigo: "",
  descripcion: "",
  tasaCambio: "1",
  esMonedaBase: "false",
};

export default function MonedasPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { toast } = useToast();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>(null);
  const [form, setForm] = useState<MonedaFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const monedasQuery = useMemoFirebase(
    () => tenant.query("monedas", orderBy("codigo")),
    [tenant]
  );
  const { data: monedas, isLoading, forceRefetch } = useCollection<Moneda>(monedasQuery);

  const baseMonedaId = useMemo(
    () => (monedas || []).find((m) => m.esMonedaBase)?.id || "",
    [monedas]
  );

  const openCreateDialog = () => {
    setSelectedMoneda(null);
    setForm({
      codigo: "PYG",
      descripcion: "Guarani Paraguayo",
      tasaCambio: "1",
      esMonedaBase: baseMonedaId ? "false" : "true",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (moneda: Moneda) => {
    setSelectedMoneda(moneda);
    setForm({
      codigo: moneda.codigo || "",
      descripcion: moneda.descripcion || "",
      tasaCambio: String(moneda.tasaCambio ?? 1),
      esMonedaBase: moneda.esMonedaBase ? "true" : "false",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedMoneda(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!firestore) return;

    const codigo = form.codigo.trim().toUpperCase();
    const descripcion = form.descripcion.trim();
    const tasaCambio = Number(form.tasaCambio);
    const esMonedaBase = form.esMonedaBase === "true";

    if (!codigo || !descripcion) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Complete codigo y descripcion.",
      });
      return;
    }
    if (!Number.isFinite(tasaCambio) || tasaCambio <= 0) {
      toast({
        variant: "destructive",
        title: "Tasa invalida",
        description: "La tasa de cambio debe ser mayor a cero.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const monedasCol = tenant.collection("monedas");
      if (!monedasCol) return;

      if (esMonedaBase) {
        for (const m of monedas || []) {
          if (selectedMoneda && m.id === selectedMoneda.id) continue;
          if (m.esMonedaBase) {
            const monedaRef = tenant.doc("monedas", m.id);
            if (!monedaRef) continue;
            batch.update(monedaRef, { esMonedaBase: false });
          }
        }
      }

      const payload: Omit<Moneda, "id"> = {
        codigo,
        descripcion,
        tasaCambio,
        esMonedaBase,
      };

      if (selectedMoneda) {
        const monedaRef = tenant.doc("monedas", selectedMoneda.id);
        if (!monedaRef) return;
        batch.update(monedaRef, payload);
      } else {
        batch.set(doc(monedasCol), payload);
      }

      await batch.commit();
      toast({ title: selectedMoneda ? "Moneda actualizada" : "Moneda creada" });
      closeDialog();
      forceRefetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar moneda",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Maestro de Monedas"
        description="Configure monedas y la moneda base del sistema."
      >
        <Button onClick={openCreateDialog}>Nueva Moneda</Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Monedas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className="text-right">Tasa Cambio</TableHead>
                <TableHead>Base</TableHead>
                <TableHead className="text-right">Accion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                (monedas || []).map((moneda) => (
                  <TableRow key={moneda.id}>
                    <TableCell className="font-medium">{moneda.codigo}</TableCell>
                    <TableCell>{moneda.descripcion}</TableCell>
                    <TableCell className="text-right">{Number(moneda.tasaCambio || 0).toLocaleString("es-PY")}</TableCell>
                    <TableCell>
                      {moneda.esMonedaBase ? <Badge className="bg-green-600">Base</Badge> : <Badge variant="outline">No</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(moneda)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && (monedas || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center">
                    No hay monedas. Cree al menos PYG.
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
            <DialogTitle>{selectedMoneda ? "Editar Moneda" : "Nueva Moneda"}</DialogTitle>
            <DialogDescription>Defina codigo, descripcion, tasa y si es moneda base.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Codigo</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                placeholder="PYG"
                maxLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label>Descripcion</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Guarani Paraguayo"
              />
            </div>
            <div className="space-y-1">
              <Label>Tasa de Cambio</Label>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={form.tasaCambio}
                onChange={(e) => setForm((prev) => ({ ...prev, tasaCambio: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label>Moneda Base</Label>
              <Select value={form.esMonedaBase} onValueChange={(v) => setForm((prev) => ({ ...prev, esMonedaBase: v as "true" | "false" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Si</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

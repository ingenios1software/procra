"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, where, writeBatch } from "firebase/firestore";
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
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { CuentaCajaBanco, Moneda, PlanDeCuenta } from "@/lib/types";

type CuentaFormState = {
  nombre: string;
  tipo: CuentaCajaBanco["tipo"];
  monedaId: string;
  cuentaContableId: string;
  activo: "true" | "false";
};

const DEFAULT_FORM: CuentaFormState = {
  nombre: "",
  tipo: "CAJA",
  monedaId: "",
  cuentaContableId: "",
  activo: "true",
};

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function CuentasCajaBancoPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaCajaBanco | null>(null);
  const [form, setForm] = useState<CuentaFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [cuentaToDelete, setCuentaToDelete] = useState<CuentaCajaBanco | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const cuentasQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "cuentasCajaBanco"), orderBy("nombre")) : null),
    [firestore]
  );
  const monedasQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "monedas"), orderBy("codigo")) : null),
    [firestore]
  );
  const planQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "planDeCuentas"), orderBy("codigo")) : null),
    [firestore]
  );

  const {
    data: cuentasCajaBanco,
    isLoading: isLoadingCuentas,
    forceRefetch: refetchCuentas,
  } = useCollection<CuentaCajaBanco>(cuentasQuery);
  const { data: monedas, isLoading: isLoadingMonedas } = useCollection<Moneda>(monedasQuery);
  const { data: planDeCuentas, isLoading: isLoadingPlan } = useCollection<PlanDeCuenta>(planQuery);

  const monedasById = useMemo(() => new Map((monedas || []).map((m) => [m.id, m])), [monedas]);
  const planById = useMemo(() => new Map((planDeCuentas || []).map((c) => [c.id, c])), [planDeCuentas]);

  const isLoading = isLoadingCuentas || isLoadingMonedas || isLoadingPlan;

  const openCreateDialog = () => {
    setSelectedCuenta(null);
    setForm({
      nombre: "",
      tipo: "CAJA",
      monedaId: (monedas || [])[0]?.id || "",
      cuentaContableId: (planDeCuentas || [])[0]?.id || "",
      activo: "true",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (cuenta: CuentaCajaBanco) => {
    setSelectedCuenta(cuenta);
    setForm({
      nombre: cuenta.nombre || "",
      tipo: cuenta.tipo || "CAJA",
      monedaId: cuenta.monedaId || "",
      cuentaContableId: cuenta.cuentaContableId || "",
      activo: cuenta.activo === false ? "false" : "true",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCuenta(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!firestore) return;

    const nombre = form.nombre.trim();
    if (!nombre || !form.monedaId || !form.cuentaContableId) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Complete nombre, moneda y cuenta contable.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Omit<CuentaCajaBanco, "id"> = {
        nombre,
        tipo: form.tipo,
        monedaId: form.monedaId,
        cuentaContableId: form.cuentaContableId,
        activo: form.activo === "true",
      };

      const batch = writeBatch(firestore);
      if (selectedCuenta) {
        batch.update(doc(firestore, "cuentasCajaBanco", selectedCuenta.id), payload);
      } else {
        batch.set(doc(collection(firestore, "cuentasCajaBanco")), payload);
      }
      await batch.commit();

      toast({ title: selectedCuenta ? "Cuenta actualizada" : "Cuenta creada" });
      closeDialog();
      refetchCuentas();
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

  const toggleActiva = async (cuenta: CuentaCajaBanco) => {
    if (!firestore) return;
    try {
      await writeBatch(firestore)
        .update(doc(firestore, "cuentasCajaBanco", cuenta.id), { activo: !cuenta.activo })
        .commit();
      toast({ title: `Cuenta ${!cuenta.activo ? "activada" : "desactivada"}` });
      refetchCuentas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar estado",
        description: error?.message || "Error inesperado.",
      });
    }
  };

  const handleAutoConfig = async () => {
    if (!firestore) return;
    setIsAutoConfiguring(true);
    try {
      const monedasActuales = monedas || [];
      const cuentasActuales = cuentasCajaBanco || [];
      const plan = planDeCuentas || [];

      const planActivos = plan.filter((cuenta) => cuenta.tipo === "activo" && cuenta.naturaleza === "deudora");
      const planCaja =
        planActivos.find((cuenta) => normalizeText(`${cuenta.codigo} ${cuenta.nombre}`).includes("caja")) ||
        planActivos.find((cuenta) => (cuenta.codigo || "").trim().startsWith("1.1.1")) ||
        planActivos[0];
      const planBanco =
        planActivos.find((cuenta) => normalizeText(`${cuenta.codigo} ${cuenta.nombre}`).includes("banco")) ||
        planActivos.find((cuenta) => (cuenta.codigo || "").trim().startsWith("1.1.2")) ||
        null;

      if (!planCaja) {
        toast({
          variant: "destructive",
          title: "Sin cuenta contable de activo",
          description: "Primero cree en Plan de Cuentas una cuenta de caja (activo/deudora).",
        });
        return;
      }

      const batch = writeBatch(firestore);
      const createdItems: string[] = [];

      let pygId =
        monedasActuales.find((m) => normalizeText(m.codigo) === "pyg")?.id ||
        monedasActuales.find((m) => {
          const hint = normalizeText(`${m.codigo} ${m.descripcion}`);
          return hint.includes("guarani") || hint.includes("gs");
        })?.id ||
        "";

      if (!pygId) {
        const monedaRef = doc(collection(firestore, "monedas"));
        pygId = monedaRef.id;
        const hasBase = monedasActuales.some((m) => m.esMonedaBase);
        batch.set(monedaRef, {
          codigo: "PYG",
          descripcion: "Guarani Paraguayo",
          tasaCambio: 1,
          esMonedaBase: !hasBase,
        } as Omit<Moneda, "id">);
        createdItems.push("Moneda PYG");
      }

      const existeCajaPyg = cuentasActuales.some(
        (cuenta) => cuenta.tipo === "CAJA" && cuenta.monedaId === pygId
      );
      if (!existeCajaPyg) {
        const cajaRef = doc(collection(firestore, "cuentasCajaBanco"));
        batch.set(cajaRef, {
          nombre: "Caja Jornaleros Gs",
          tipo: "CAJA",
          monedaId: pygId,
          cuentaContableId: planCaja.id,
          activo: true,
        } as Omit<CuentaCajaBanco, "id">);
        createdItems.push("Caja Jornaleros Gs");
      }

      if (planBanco) {
        const existeBancoPyg = cuentasActuales.some(
          (cuenta) => cuenta.tipo === "BANCO" && cuenta.monedaId === pygId
        );
        if (!existeBancoPyg) {
          const bancoRef = doc(collection(firestore, "cuentasCajaBanco"));
          batch.set(bancoRef, {
            nombre: "Banco Principal Gs",
            tipo: "BANCO",
            monedaId: pygId,
            cuentaContableId: planBanco.id,
            activo: true,
          } as Omit<CuentaCajaBanco, "id">);
          createdItems.push("Banco Principal Gs");
        }
      }

      if (createdItems.length === 0) {
        toast({
          title: "Sin cambios",
          description: "Ya existe configuracion base de moneda y cuentas caja/banco.",
        });
        return;
      }

      await batch.commit();
      toast({
        title: "Autoconfiguracion completada",
        description: `Creados: ${createdItems.join(", ")}.`,
      });
      refetchCuentas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo autoconfigurar",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const validarUsoCuenta = async (cuentaId: string): Promise<string[]> => {
    if (!firestore) return [];
    const checks: Array<{ coleccion: string; campo: string; etiqueta: string }> = [
      { coleccion: "movimientosTesoreria", campo: "cuentaOrigenCajaBancoId", etiqueta: "Movimientos de Tesoreria (origen)" },
      { coleccion: "movimientosTesoreria", campo: "cuentaDestinoCajaBancoId", etiqueta: "Movimientos de Tesoreria (destino)" },
      { coleccion: "pagosNominaHoras", campo: "cuentaCajaBancoId", etiqueta: "Pagos de Nomina por Horas" },
      { coleccion: "cobrosCxc", campo: "cuentaCajaBancoId", etiqueta: "Cobros de Cuentas por Cobrar" },
      { coleccion: "pagosCxp", campo: "cuentaCajaBancoId", etiqueta: "Pagos de Cuentas por Pagar" },
    ];

    const usedIn: string[] = [];
    for (const check of checks) {
      const q = query(collection(firestore, check.coleccion), where(check.campo, "==", cuentaId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) usedIn.push(check.etiqueta);
    }
    return usedIn;
  };

  const handleDeleteCuenta = async () => {
    if (!firestore || !cuentaToDelete) return;
    setIsDeleting(true);
    try {
      const usedIn = await validarUsoCuenta(cuentaToDelete.id);
      if (usedIn.length > 0) {
        toast({
          variant: "destructive",
          title: "No se puede eliminar",
          description: `La cuenta tiene uso en: ${usedIn.join(", ")}. Desactive en lugar de eliminar.`,
        });
        return;
      }

      await deleteDoc(doc(firestore, "cuentasCajaBanco", cuentaToDelete.id));
      toast({ title: "Cuenta eliminada" });
      refetchCuentas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsDeleting(false);
      setCuentaToDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Maestro de Cuentas de Caja/Banco"
        description="Configure cajas, bancos y su relacion con moneda y cuenta contable."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoConfig} disabled={isAutoConfiguring}>
            {isAutoConfiguring ? "Autoconfigurando..." : "Autoconfigurar Base"}
          </Button>
          <Button onClick={openCreateDialog}>Nueva Cuenta</Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas de Caja/Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Cuenta Contable</TableHead>
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
                (cuentasCajaBanco || []).map((cuenta) => {
                  const moneda = monedasById.get(cuenta.monedaId);
                  const plan = cuenta.cuentaContableId ? planById.get(cuenta.cuentaContableId) : null;
                  return (
                    <TableRow key={cuenta.id}>
                      <TableCell className="font-medium">{cuenta.nombre}</TableCell>
                      <TableCell>{cuenta.tipo}</TableCell>
                      <TableCell>{moneda ? `${moneda.codigo} - ${moneda.descripcion}` : cuenta.monedaId}</TableCell>
                      <TableCell>{plan ? `${plan.codigo} - ${plan.nombre}` : "-"}</TableCell>
                      <TableCell>
                        {cuenta.activo ? <Badge className="bg-green-600">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(cuenta)}>
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleActiva(cuenta)}>
                            {cuenta.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setCuentaToDelete(cuenta)}>
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!isLoading && (cuentasCajaBanco || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center">
                    No hay cuentas de caja/banco.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCuenta ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
            <DialogDescription>Defina nombre, tipo, moneda y cuenta contable asociada.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Caja Jornaleros Gs"
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((prev) => ({ ...prev, tipo: v as CuentaCajaBanco["tipo"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAJA">CAJA</SelectItem>
                  <SelectItem value="BANCO">BANCO</SelectItem>
                  <SelectItem value="BILLETERA">BILLETERA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={form.monedaId} onValueChange={(v) => setForm((prev) => ({ ...prev, monedaId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione moneda" />
                </SelectTrigger>
                <SelectContent>
                  {(monedas || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.codigo} - {m.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Cuenta Contable</Label>
              <Select value={form.cuentaContableId} onValueChange={(v) => setForm((prev) => ({ ...prev, cuentaContableId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione cuenta contable" />
                </SelectTrigger>
                <SelectContent>
                  {(planDeCuentas || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.activo} onValueChange={(v) => setForm((prev) => ({ ...prev, activo: v as "true" | "false" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activa</SelectItem>
                  <SelectItem value="false">Inactiva</SelectItem>
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

      <AlertDialog open={!!cuentaToDelete} onOpenChange={(open) => !open && setCuentaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion elimina la cuenta de caja/banco. Si tiene movimientos registrados, el sistema no permitira eliminar y debera desactivarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCuenta} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

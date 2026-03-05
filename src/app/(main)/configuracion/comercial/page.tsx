"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { EmpresaSaaS, EstadoSuscripcionSaaS, ModeloCobroSaaS, Permisos, PlanSaaS } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { toDateSafe } from "@/lib/suscripcion-saas";

const PLAN_OPTIONS: PlanSaaS[] = ["demo", "basic", "pro", "enterprise"];
const BILLING_OPTIONS: ModeloCobroSaaS[] = ["por_usuario", "por_empresa"];
const STATUS_OPTIONS: EstadoSuscripcionSaaS[] = ["trial", "activa", "vencida", "suspendida"];
const MODULE_OPTIONS: Array<{ key: keyof Permisos; label: string }> = [
  { key: "compras", label: "Compras" },
  { key: "stock", label: "Stock" },
  { key: "eventos", label: "Eventos" },
  { key: "monitoreos", label: "Monitoreos" },
  { key: "ventas", label: "Ventas" },
  { key: "contabilidad", label: "Contabilidad" },
  { key: "rrhh", label: "RRHH" },
  { key: "finanzas", label: "Finanzas" },
  { key: "agronomia", label: "Agronomia" },
  { key: "maestros", label: "Maestros" },
  { key: "administracion", label: "Administracion" },
];

const DEFAULT_MODULES: Permisos = {
  compras: true,
  stock: true,
  eventos: true,
  monitoreos: true,
  ventas: true,
  contabilidad: true,
  rrhh: true,
  finanzas: true,
  agronomia: true,
  maestros: true,
  administracion: true,
};

function toInputDate(value?: Date | string | null): string {
  const date = toDateSafe(value || null);
  if (!date) return "";
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function ConfiguracionComercialPage() {
  const firestore = useFirestore();
  const { user, permisos } = useAuth();
  const { toast } = useToast();
  const empresaId = user?.empresaId || null;
  const empresaRef = useMemoFirebase(
    () => (firestore && empresaId ? doc(firestore, "empresas", empresaId) : null),
    [firestore, empresaId]
  );
  const { data: empresa, isLoading: isLoadingEmpresa } = useDoc<EmpresaSaaS>(empresaRef);

  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState<PlanSaaS>("basic");
  const [estado, setEstado] = useState<EstadoSuscripcionSaaS>("trial");
  const [modeloCobro, setModeloCobro] = useState<ModeloCobroSaaS>("por_empresa");
  const [moneda, setMoneda] = useState<"USD" | "PYG">("USD");
  const [montoMensual, setMontoMensual] = useState("0");
  const [maxUsuarios, setMaxUsuarios] = useState("");
  const [proximoCobro, setProximoCobro] = useState("");
  const [demoHabilitado, setDemoHabilitado] = useState("si");
  const [demoFin, setDemoFin] = useState("");
  const [modulos, setModulos] = useState<Permisos>(DEFAULT_MODULES);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingEmpresa, setIsCreatingEmpresa] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    setNombre(empresa.nombre || "");
    setPlan(empresa.suscripcion?.plan || "basic");
    setEstado(empresa.suscripcion?.estado || "trial");
    setModeloCobro(empresa.suscripcion?.modeloCobro || "por_empresa");
    setMoneda(empresa.suscripcion?.moneda || "USD");
    setMontoMensual(String(empresa.suscripcion?.montoMensual || 0));
    setMaxUsuarios(
      empresa.suscripcion?.maxUsuarios === null || empresa.suscripcion?.maxUsuarios === undefined
        ? ""
        : String(empresa.suscripcion.maxUsuarios)
    );
    setProximoCobro(toInputDate(empresa.suscripcion?.proximoCobro));
    setDemoHabilitado(empresa.demo?.habilitado ? "si" : "no");
    setDemoFin(toInputDate(empresa.demo?.fin));
    setModulos({
      ...DEFAULT_MODULES,
      ...(empresa.modulos || {}),
    });
  }, [empresa]);

  const canEdit = Boolean(permisos.administracion);
  const hasEmpresa = Boolean(empresaId);
  const accessWarning = useMemo(() => {
    if (!canEdit) return "No tiene permisos para gestionar configuración comercial.";
    if (!hasEmpresa) return "Este usuario aún no tiene empresa asociada.";
    return null;
  }, [canEdit, hasEmpresa]);

  const handleCrearEmpresaBase = async () => {
    if (!firestore || !user?.id) return;
    setIsCreatingEmpresa(true);
    try {
      const newEmpresaId = `empresa_${user.id}`;
      await setDoc(
        doc(firestore, "empresas", newEmpresaId),
        {
          nombre: "Empresa Demo",
          activo: true,
          modulos: DEFAULT_MODULES,
          demo: {
            habilitado: true,
            inicio: new Date().toISOString(),
            fin: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          },
          suscripcion: {
            estado: "trial",
            plan: "demo",
            modeloCobro: "por_empresa",
            moneda: "USD",
            montoMensual: 0,
            maxUsuarios: 3,
            proximoCobro: null,
          },
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
      await updateDoc(doc(firestore, "usuarios", user.id), { empresaId: newEmpresaId });
      toast({
        title: "Empresa base creada",
        description: "Se creó una empresa demo y se asoció al usuario administrador.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo crear la empresa base",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsCreatingEmpresa(false);
    }
  };

  const handleGuardar = async () => {
    if (!firestore || !empresaId || !canEdit) return;
    if (!nombre.trim()) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
        description: "Ingrese el nombre de la empresa.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(
        doc(firestore, "empresas", empresaId),
        {
          nombre: nombre.trim(),
          activo: true,
          modulos,
          demo: {
            habilitado: demoHabilitado === "si",
            fin: dateInputToIso(demoFin),
          },
          suscripcion: {
            estado,
            plan,
            modeloCobro,
            moneda,
            montoMensual: Number(montoMensual) || 0,
            maxUsuarios: maxUsuarios.trim() ? Number(maxUsuarios) || null : null,
            proximoCobro: dateInputToIso(proximoCobro),
          },
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
      toast({
        title: "Configuración guardada",
        description: "La configuración comercial fue actualizada.",
      });
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

  return (
    <>
      <PageHeader
        title="Configuración Comercial SaaS"
        description="Defina plan, cobro mensual por usuario o empresa y periodo demo."
      />

      <div className="space-y-6">
        {accessWarning && (
          <Card>
            <CardContent className="p-6">
              <p>{accessWarning}</p>
              {canEdit && !hasEmpresa && (
                <Button className="mt-4" onClick={handleCrearEmpresaBase} disabled={isCreatingEmpresa}>
                  {isCreatingEmpresa ? "Creando..." : "Crear empresa base demo"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {canEdit && hasEmpresa && (
          <Card>
            <CardHeader>
              <CardTitle>Plan y Suscripción</CardTitle>
              <CardDescription>
                Configure el modelo de venta mensual para facturación por usuario o por empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoadingEmpresa && <p>Cargando configuración...</p>}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de empresa</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={plan} onValueChange={(v) => setPlan(v as PlanSaaS)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estado de suscripción</Label>
                  <Select value={estado} onValueChange={(v) => setEstado(v as EstadoSuscripcionSaaS)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de cobro</Label>
                  <Select value={modeloCobro} onValueChange={(v) => setModeloCobro(v as ModeloCobroSaaS)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={moneda} onValueChange={(v) => setMoneda(v as "USD" | "PYG")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="PYG">PYG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monto mensual</Label>
                  <Input type="number" min={0} step="0.01" value={montoMensual} onChange={(e) => setMontoMensual(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Máximo de usuarios (opcional)</Label>
                  <Input type="number" min={1} step={1} value={maxUsuarios} onChange={(e) => setMaxUsuarios(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Próximo cobro</Label>
                  <Input type="date" value={proximoCobro} onChange={(e) => setProximoCobro(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Demo habilitado</Label>
                  <Select value={demoHabilitado} onValueChange={setDemoHabilitado}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Sí</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Demo hasta</Label>
                  <Input type="date" value={demoFin} onChange={(e) => setDemoFin(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Módulos habilitados para esta empresa</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {MODULE_OPTIONS.map((moduleOption) => (
                    <div
                      key={moduleOption.key}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <span className="text-sm font-medium">{moduleOption.label}</span>
                      <Switch
                        checked={Boolean(modulos[moduleOption.key])}
                        onCheckedChange={(checked) =>
                          setModulos((prev) => ({
                            ...prev,
                            [moduleOption.key]: Boolean(checked),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleGuardar} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar configuración comercial"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

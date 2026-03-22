"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { DnitLookupPanel } from "@/components/common/dnit-lookup-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useTenantSelection } from "@/hooks/use-tenant-selection";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type {
  DnitTaxpayerSnapshot,
  EmpresaSaaS,
  EstadoSuscripcionSaaS,
  ModeloCobroSaaS,
  Permisos,
  PlanSaaS,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getDnitPrimaryName } from "@/lib/dnit";
import { normalizePermisos, toDateSafe } from "@/lib/suscripcion-saas";
import { buildEmpresaBasePayload, buildTenantRoleSeeds, tenantDoc } from "@/lib/tenant";

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
  { key: "usuarios", label: "Usuarios" },
  { key: "roles", label: "Roles" },
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
  usuarios: true,
  roles: true,
  administracion: true,
};

type EmpresaPerfilForm = {
  razonSocial: string;
  rubro: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  ciudad: string;
  pais: string;
  contacto: string;
  observaciones: string;
};

type EmpresaBrandingForm = {
  logoSrc: string;
  preparedBy: string;
  approvedBy: string;
};

const EMPTY_EMPRESA_PERFIL: EmpresaPerfilForm = {
  razonSocial: "",
  rubro: "",
  ruc: "",
  direccion: "",
  telefono: "",
  email: "",
  ciudad: "",
  pais: "Paraguay",
  contacto: "",
  observaciones: "",
};

const EMPTY_EMPRESA_BRANDING: EmpresaBrandingForm = {
  logoSrc: "",
  preparedBy: "",
  approvedBy: "",
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

function toOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export default function ConfiguracionComercialPage() {
  const firestore = useFirestore();
  const { user, permisos } = useAuth();
  const { empresaId, canSelectEmpresa } = useTenantSelection();
  const { toast } = useToast();
  const empresaRef = useMemoFirebase(
    () => (firestore && empresaId ? doc(firestore, "empresas", empresaId) : null),
    [firestore, empresaId]
  );
  const { data: empresa, isLoading: isLoadingEmpresa } = useDoc<EmpresaSaaS>(empresaRef);

  const [nombre, setNombre] = useState("");
  const [perfil, setPerfil] = useState<EmpresaPerfilForm>(EMPTY_EMPRESA_PERFIL);
  const [branding, setBranding] = useState<EmpresaBrandingForm>(EMPTY_EMPRESA_BRANDING);
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
  const [dnitData, setDnitData] = useState<DnitTaxpayerSnapshot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingEmpresa, setIsCreatingEmpresa] = useState(false);

  useEffect(() => {
    if (!empresa) return;

    setNombre(empresa.nombre || "");
    setPerfil({
      razonSocial: empresa.perfil?.razonSocial || "",
      rubro: empresa.perfil?.rubro || "",
      ruc: empresa.perfil?.ruc || "",
      direccion: empresa.perfil?.direccion || "",
      telefono: empresa.perfil?.telefono || "",
      email: empresa.perfil?.email || "",
      ciudad: empresa.perfil?.ciudad || "",
      pais: empresa.perfil?.pais || "Paraguay",
      contacto: empresa.perfil?.contacto || "",
      observaciones: empresa.perfil?.observaciones || "",
    });
    setBranding({
      logoSrc: empresa.branding?.logoSrc || "",
      preparedBy: empresa.branding?.preparedBy || "",
      approvedBy: empresa.branding?.approvedBy || "",
    });
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
    setDnitData(empresa.dnit || null);
    setModulos(normalizePermisos({
      ...DEFAULT_MODULES,
      ...(empresa.modulos || {}),
    }));
  }, [empresa]);

  const canEdit = Boolean(permisos.administracion);
  const hasEmpresa = Boolean(empresaId);
  const accessWarning = useMemo(() => {
    if (!canEdit) return "No tiene permisos para gestionar la configuracion de empresa.";
    if (canSelectEmpresa && !hasEmpresa) return "Seleccione una empresa cliente para administrar su configuracion.";
    if (!hasEmpresa) return "Este usuario aun no tiene una empresa asociada.";
    return null;
  }, [canEdit, canSelectEmpresa, hasEmpresa]);

  const handlePerfilChange = <K extends keyof EmpresaPerfilForm>(field: K, value: EmpresaPerfilForm[K]) => {
    setPerfil((prev) => ({ ...prev, [field]: value }));
  };

  const handleBrandingChange = <K extends keyof EmpresaBrandingForm>(field: K, value: EmpresaBrandingForm[K]) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const handleCrearEmpresaBase = async () => {
    if (!firestore || !user?.id) return;

    setIsCreatingEmpresa(true);
    try {
      const newEmpresaId = `empresa_${user.id}`;
      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, "empresas", newEmpresaId),
        buildEmpresaBasePayload({
          nombre: "Mi Empresa",
          contacto: user.nombre,
          email: user.email,
          pais: "Paraguay",
          plan: "demo",
          maxUsuarios: 3,
          modulos: DEFAULT_MODULES,
        }),
        { merge: true }
      );
      buildTenantRoleSeeds().forEach((role) => {
        batch.set(
          tenantDoc(firestore, newEmpresaId, "roles", role.id),
          {
            nombre: role.nombre,
            descripcion: role.descripcion,
            permisos: role.permisos,
            soloLectura: role.soloLectura,
            esSistema: role.esSistema,
          },
          { merge: true }
        );
      });
      batch.update(doc(firestore, "usuarios", user.id), { empresaId: newEmpresaId });
      await batch.commit();
      toast({
        title: "Empresa base creada",
        description: "Ya puede completar la ficha de empresa con sus datos reales.",
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
        description: "Ingrese el nombre comercial de la empresa.",
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
          ...(dnitData ? { dnit: dnitData } : {}),
          perfil: {
            razonSocial: toOptionalText(perfil.razonSocial),
            rubro: toOptionalText(perfil.rubro),
            ruc: toOptionalText(perfil.ruc),
            direccion: toOptionalText(perfil.direccion),
            telefono: toOptionalText(perfil.telefono),
            email: toOptionalText(perfil.email),
            ciudad: toOptionalText(perfil.ciudad),
            pais: toOptionalText(perfil.pais),
            contacto: toOptionalText(perfil.contacto),
            observaciones: toOptionalText(perfil.observaciones),
          },
          branding: {
            logoSrc: toOptionalText(branding.logoSrc),
            preparedBy: toOptionalText(branding.preparedBy),
            approvedBy: toOptionalText(branding.approvedBy),
          },
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
        title: "Empresa actualizada",
        description: "La ficha de empresa y la configuracion comercial fueron guardadas.",
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

  const handleApplyDnit = (taxpayer: DnitTaxpayerSnapshot) => {
    setDnitData(taxpayer);
    setNombre(getDnitPrimaryName(taxpayer) || taxpayer.documento);
    setPerfil((prev) => ({
      ...prev,
      razonSocial: taxpayer.razonSocial || prev.razonSocial,
      ruc: taxpayer.documento,
    }));
    toast({
      title: "Datos DNIT aplicados",
      description: `La ficha fiscal fue actualizada con ${taxpayer.documento}.`,
    });
  };

  return (
    <>
      <PageHeader
        title="Empresa y Configuracion Comercial"
        description="Registre la empresa cliente, sus datos fiscales y el esquema comercial del sistema."
      >
        <Button asChild variant="outline">
          <Link href="/configuracion/dnit">Administrar cache DNIT</Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {accessWarning && (
          <Card>
            <CardContent className="p-6">
              <p>{accessWarning}</p>
              {canEdit && !hasEmpresa && !canSelectEmpresa && (
                <Button className="mt-4" onClick={handleCrearEmpresaBase} disabled={isCreatingEmpresa}>
                  {isCreatingEmpresa ? "Creando..." : "Crear empresa base"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {canEdit && hasEmpresa && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Ficha de la Empresa</CardTitle>
                <CardDescription>
                  Complete los datos comerciales, fiscales y de contacto. Estos datos quedaran listos
                  para futuros comprobantes, PDFs y membretes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingEmpresa && <p>Cargando configuracion...</p>}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="empresa-nombre">Nombre comercial</Label>
                    <Input id="empresa-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-razon-social">Razon social</Label>
                    <Input
                      id="empresa-razon-social"
                      value={perfil.razonSocial}
                      onChange={(e) => handlePerfilChange("razonSocial", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-rubro">Rubro</Label>
                    <Input
                      id="empresa-rubro"
                      placeholder="Agricultura, ganaderia, agroindustria..."
                      value={perfil.rubro}
                      onChange={(e) => handlePerfilChange("rubro", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-ruc">RUC</Label>
                    <Input
                      id="empresa-ruc"
                      placeholder="80012345-6"
                      value={perfil.ruc}
                      onChange={(e) => handlePerfilChange("ruc", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-contacto">Contacto principal</Label>
                    <Input
                      id="empresa-contacto"
                      value={perfil.contacto}
                      onChange={(e) => handlePerfilChange("contacto", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-telefono">Telefono</Label>
                    <Input
                      id="empresa-telefono"
                      value={perfil.telefono}
                      onChange={(e) => handlePerfilChange("telefono", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-email">Email</Label>
                    <Input
                      id="empresa-email"
                      type="email"
                      value={perfil.email}
                      onChange={(e) => handlePerfilChange("email", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="empresa-direccion">Direccion</Label>
                    <Input
                      id="empresa-direccion"
                      value={perfil.direccion}
                      onChange={(e) => handlePerfilChange("direccion", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-ciudad">Ciudad</Label>
                    <Input
                      id="empresa-ciudad"
                      value={perfil.ciudad}
                      onChange={(e) => handlePerfilChange("ciudad", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empresa-pais">Pais</Label>
                    <Input
                      id="empresa-pais"
                      value={perfil.pais}
                      onChange={(e) => handlePerfilChange("pais", e.target.value)}
                    />
                  </div>
                </div>

                <DnitLookupPanel
                  ruc={perfil.ruc || ""}
                  value={dnitData}
                  onApply={handleApplyDnit}
                  entityLabel="empresa"
                />

                <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <div className="space-y-2">
                    <Label htmlFor="empresa-observaciones">Observaciones</Label>
                    <Textarea
                      id="empresa-observaciones"
                      placeholder="Notas internas, referencias comerciales o informacion complementaria."
                      value={perfil.observaciones}
                      onChange={(e) => handlePerfilChange("observaciones", e.target.value)}
                    />
                  </div>

                  <div className="space-y-4 rounded-xl border p-4">
                    <div className="space-y-2">
                      <Label htmlFor="empresa-logo">Logo URL (opcional)</Label>
                      <Input
                        id="empresa-logo"
                        placeholder="https://... o /branding/logo.png"
                        value={branding.logoSrc}
                        onChange={(e) => handleBrandingChange("logoSrc", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa-prepared-by">Cargo firma 1</Label>
                      <Input
                        id="empresa-prepared-by"
                        placeholder="Responsable operativo"
                        value={branding.preparedBy}
                        onChange={(e) => handleBrandingChange("preparedBy", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa-approved-by">Cargo firma 2</Label>
                      <Input
                        id="empresa-approved-by"
                        placeholder="Gerencia / Administracion"
                        value={branding.approvedBy}
                        onChange={(e) => handleBrandingChange("approvedBy", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Datos listos para reportes y comprobantes</p>
                    <p className="text-sm text-muted-foreground">
                      Lo que cargue aqui quedara disponible para PDFs, impresiones y membrete futuro.
                    </p>
                  </div>
                  <Button onClick={handleGuardar} disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar empresa"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Suscripcion y Modulos SaaS</CardTitle>
                <CardDescription>
                  Mantenga aqui el plan comercial, las fechas y los modulos habilitados para la empresa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={plan} onValueChange={(value) => setPlan(value as PlanSaaS)}>
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
                    <Label>Estado de suscripcion</Label>
                    <Select value={estado} onValueChange={(value) => setEstado(value as EstadoSuscripcionSaaS)}>
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
                    <Select value={modeloCobro} onValueChange={(value) => setModeloCobro(value as ModeloCobroSaaS)}>
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
                    <Select value={moneda} onValueChange={(value) => setMoneda(value as "USD" | "PYG")}>
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
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={montoMensual}
                      onChange={(e) => setMontoMensual(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Maximo de usuarios</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={maxUsuarios}
                      onChange={(e) => setMaxUsuarios(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Proximo cobro</Label>
                    <Input type="date" value={proximoCobro} onChange={(e) => setProximoCobro(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Demo hasta</Label>
                    <Input type="date" value={demoFin} onChange={(e) => setDemoFin(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Demo habilitado</p>
                      <p className="text-sm text-muted-foreground">
                        Mantiene acceso temporal aunque aun no haya suscripcion activa.
                      </p>
                    </div>
                    <Switch checked={demoHabilitado === "si"} onCheckedChange={(checked) => setDemoHabilitado(checked ? "si" : "no")} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Modulos habilitados para esta empresa</Label>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  {isSaving ? "Guardando..." : "Guardar configuracion comercial"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

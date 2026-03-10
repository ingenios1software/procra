import type { EmpresaSaaS, Permisos } from "@/lib/types";

export const ALL_MODULES_ENABLED: Permisos = {
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

export function normalizePermisos(source?: Partial<Permisos> | null): Permisos {
  const administracion = source?.administracion === true;

  return {
    compras: source?.compras === true,
    stock: source?.stock === true,
    eventos: source?.eventos === true,
    monitoreos: source?.monitoreos === true,
    ventas: source?.ventas === true,
    contabilidad: source?.contabilidad === true,
    rrhh: source?.rrhh === true,
    finanzas: source?.finanzas === true,
    agronomia: source?.agronomia === true,
    maestros: source?.maestros === true,
    usuarios: source?.usuarios ?? administracion,
    roles: source?.roles ?? administracion,
    administracion,
  };
}

export function toDateSafe(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDemoActivo(empresa: EmpresaSaaS | null | undefined, referencia = new Date()): boolean {
  if (!empresa?.demo?.habilitado) return false;
  const demoFin = toDateSafe(empresa.demo.fin);
  if (!demoFin) return false;
  return referencia.getTime() <= demoFin.getTime();
}

export function isSuscripcionActiva(empresa: EmpresaSaaS | null | undefined, referencia = new Date()): boolean {
  if (!empresa?.activo) return false;
  if (isDemoActivo(empresa, referencia)) return true;

  const estado = empresa.suscripcion?.estado;
  if (estado === "activa" || estado === "trial") return true;

  return false;
}

export function getEstadoComercial(empresa: EmpresaSaaS | null | undefined, referencia = new Date()): {
  acceso: boolean;
  esDemo: boolean;
  motivo: "sin_empresa" | "inactiva" | "demo_activo" | "suscripcion_activa" | "sin_suscripcion";
} {
  if (!empresa) {
    return { acceso: false, esDemo: false, motivo: "sin_empresa" };
  }
  if (!empresa.activo) {
    return { acceso: false, esDemo: false, motivo: "inactiva" };
  }
  if (isDemoActivo(empresa, referencia)) {
    return { acceso: true, esDemo: true, motivo: "demo_activo" };
  }
  if (isSuscripcionActiva(empresa, referencia)) {
    return { acceso: true, esDemo: false, motivo: "suscripcion_activa" };
  }
  return { acceso: false, esDemo: false, motivo: "sin_suscripcion" };
}

export function resolveModulosComprados(empresa: EmpresaSaaS | null | undefined): Permisos {
  return normalizePermisos({
    ...ALL_MODULES_ENABLED,
    ...(empresa?.modulos || {}),
  });
}

export function mergePermisosByGate(base: Permisos, gate: Permisos): Permisos {
  return {
    compras: base.compras && gate.compras,
    stock: base.stock && gate.stock,
    eventos: base.eventos && gate.eventos,
    monitoreos: base.monitoreos && gate.monitoreos,
    ventas: base.ventas && gate.ventas,
    contabilidad: base.contabilidad && gate.contabilidad,
    rrhh: base.rrhh && gate.rrhh,
    finanzas: base.finanzas && gate.finanzas,
    agronomia: base.agronomia && gate.agronomia,
    maestros: base.maestros && gate.maestros,
    usuarios: base.usuarios && gate.usuarios,
    roles: base.roles && gate.roles,
    administracion: base.administracion && gate.administracion,
  };
}

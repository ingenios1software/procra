import type { PlanDeCuenta } from "@/lib/types";

export const CODIGOS_CUENTAS_BASE = {
  CAJA: "1.1.1",
  BANCO: "1.1.2",
  CLIENTES: "1.1.3",
  INVENTARIO: "1.1.5",
  PROVEEDORES: "2.1.1",
  OBLIGACIONES_SERVICIO_COSECHA: "2.1.3",
  IVA_DEBITO: "2.1.2",
  VENTAS: "4.1.1",
  CMV: "5.1.1",
  GASTOS_EVENTOS: "5.2.1",
} as const;

export const PLAN_DE_CUENTAS_BASE: Omit<PlanDeCuenta, "id">[] = [
  { codigo: CODIGOS_CUENTAS_BASE.CAJA, nombre: "Caja General", tipo: "activo", naturaleza: "deudora" },
  { codigo: CODIGOS_CUENTAS_BASE.BANCO, nombre: "Bancos", tipo: "activo", naturaleza: "deudora" },
  { codigo: CODIGOS_CUENTAS_BASE.CLIENTES, nombre: "Clientes", tipo: "activo", naturaleza: "deudora" },
  { codigo: CODIGOS_CUENTAS_BASE.INVENTARIO, nombre: "Inventario de Insumos", tipo: "activo", naturaleza: "deudora" },
  { codigo: CODIGOS_CUENTAS_BASE.PROVEEDORES, nombre: "Proveedores", tipo: "pasivo", naturaleza: "acreedora" },
  {
    codigo: CODIGOS_CUENTAS_BASE.OBLIGACIONES_SERVICIO_COSECHA,
    nombre: "Obligaciones por Servicios de Cosecha",
    tipo: "pasivo",
    naturaleza: "acreedora",
  },
  { codigo: CODIGOS_CUENTAS_BASE.IVA_DEBITO, nombre: "IVA Debito Fiscal", tipo: "pasivo", naturaleza: "acreedora" },
  { codigo: CODIGOS_CUENTAS_BASE.VENTAS, nombre: "Ventas de Productos", tipo: "ingreso", naturaleza: "acreedora" },
  { codigo: CODIGOS_CUENTAS_BASE.CMV, nombre: "Costo de Mercaderias Vendidas", tipo: "costo", naturaleza: "deudora" },
  { codigo: CODIGOS_CUENTAS_BASE.GASTOS_EVENTOS, nombre: "Gastos Operativos de Campo", tipo: "gasto", naturaleza: "deudora" },
];

const normalizeCode = (value: string) => value.replace(/\s+/g, "").trim().toLowerCase();

export function findPlanCuentaByCodigo(
  cuentas: PlanDeCuenta[] | null | undefined,
  codigo: string
): PlanDeCuenta | undefined {
  if (!cuentas || cuentas.length === 0) return undefined;
  const target = normalizeCode(codigo);
  return cuentas.find((cuenta) => normalizeCode(cuenta.codigo) === target);
}

export function getCuentasBaseFaltantes(cuentas: PlanDeCuenta[] | null | undefined): Omit<PlanDeCuenta, "id">[] {
  if (!cuentas || cuentas.length === 0) {
    return [...PLAN_DE_CUENTAS_BASE];
  }
  return PLAN_DE_CUENTAS_BASE.filter((base) => !findPlanCuentaByCodigo(cuentas, base.codigo));
}

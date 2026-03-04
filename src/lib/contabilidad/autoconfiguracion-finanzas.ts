import { collection, doc, writeBatch, type Firestore } from "firebase/firestore";
import type { CuentaCajaBanco, Moneda, PlanDeCuenta } from "@/lib/types";

type AutoConfigFinanzasInput = {
  firestore: Firestore;
  monedas: Moneda[];
  cuentasCajaBanco: CuentaCajaBanco[];
  planDeCuentas: PlanDeCuenta[];
};

export type AutoConfigFinanzasResult = {
  createdItems: string[];
};

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCode(value?: string): string {
  return (value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function pickNextCodigo(plan: Array<{ codigo: string }>, preferred: string, prefix: string): string {
  const usedCodes = new Set(plan.map((cuenta) => normalizeCode(cuenta.codigo)));
  if (!usedCodes.has(normalizeCode(preferred))) return preferred;
  let next = 1;
  while (usedCodes.has(normalizeCode(`${prefix}${next}`))) {
    next += 1;
  }
  return `${prefix}${next}`;
}

export async function autoconfigurarBaseFinanzasNomina({
  firestore,
  monedas,
  cuentasCajaBanco,
  planDeCuentas,
}: AutoConfigFinanzasInput): Promise<AutoConfigFinanzasResult> {
  const planActual: PlanDeCuenta[] = [...(planDeCuentas || [])];
  const createdItems: string[] = [];
  const batch = writeBatch(firestore);

  const planActivos = () => planActual.filter((cuenta) => cuenta.tipo === "activo" && cuenta.naturaleza === "deudora");

  let planCaja =
    planActivos().find((cuenta) => normalizeText(`${cuenta.codigo} ${cuenta.nombre}`).includes("caja")) ||
    planActivos().find((cuenta) => (cuenta.codigo || "").trim().startsWith("1.1.1")) ||
    null;

  if (!planCaja) {
    const cuentaRef = doc(collection(firestore, "planDeCuentas"));
    const codigo = pickNextCodigo(planActual, "1.1.1", "1.1.");
    const payload: Omit<PlanDeCuenta, "id"> = {
      codigo,
      nombre: "Caja General",
      tipo: "activo",
      naturaleza: "deudora",
    };
    batch.set(cuentaRef, payload);
    planCaja = { id: cuentaRef.id, ...payload };
    planActual.push(planCaja);
    createdItems.push(`Cuenta contable ${codigo} - Caja General`);
  }

  let planBanco =
    planActivos().find((cuenta) => normalizeText(`${cuenta.codigo} ${cuenta.nombre}`).includes("banco")) ||
    planActivos().find((cuenta) => (cuenta.codigo || "").trim().startsWith("1.1.2")) ||
    null;

  if (!planBanco) {
    const cuentaRef = doc(collection(firestore, "planDeCuentas"));
    const codigo = pickNextCodigo(planActual, "1.1.2", "1.1.");
    const payload: Omit<PlanDeCuenta, "id"> = {
      codigo,
      nombre: "Bancos",
      tipo: "activo",
      naturaleza: "deudora",
    };
    batch.set(cuentaRef, payload);
    planBanco = { id: cuentaRef.id, ...payload };
    planActual.push(planBanco);
    createdItems.push(`Cuenta contable ${codigo} - Bancos`);
  }

  const cuentaJornales =
    planActual.find((cuenta) => {
      if (!["gasto", "costo"].includes(cuenta.tipo)) return false;
      const hint = normalizeText(`${cuenta.codigo} ${cuenta.nombre}`);
      return hint.includes("jornal") || hint.includes("sueldo") || hint.includes("mano de obra");
    }) || null;

  if (!cuentaJornales) {
    const cuentaRef = doc(collection(firestore, "planDeCuentas"));
    const codigo = pickNextCodigo(planActual, "5.2.2", "5.2.");
    const payload: Omit<PlanDeCuenta, "id"> = {
      codigo,
      nombre: "Jornales por Horas",
      tipo: "gasto",
      naturaleza: "deudora",
    };
    batch.set(cuentaRef, payload);
    planActual.push({ id: cuentaRef.id, ...payload });
    createdItems.push(`Cuenta contable ${codigo} - Jornales por Horas`);
  }

  let pygId =
    monedas.find((m) => normalizeText(m.codigo) === "pyg")?.id ||
    monedas.find((m) => {
      const hint = normalizeText(`${m.codigo} ${m.descripcion}`);
      return hint.includes("guarani") || hint.includes("gs");
    })?.id ||
    "";

  if (!pygId) {
    const monedaRef = doc(collection(firestore, "monedas"));
    pygId = monedaRef.id;
    const hasBase = monedas.some((m) => m.esMonedaBase);
    batch.set(monedaRef, {
      codigo: "PYG",
      descripcion: "Guarani Paraguayo",
      tasaCambio: 1,
      esMonedaBase: !hasBase,
    } as Omit<Moneda, "id">);
    createdItems.push("Moneda PYG");
  }

  const existeCajaPyg = cuentasCajaBanco.some((cuenta) => cuenta.tipo === "CAJA" && cuenta.monedaId === pygId);
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
    const existeBancoPyg = cuentasCajaBanco.some((cuenta) => cuenta.tipo === "BANCO" && cuenta.monedaId === pygId);
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

  if (createdItems.length > 0) {
    await batch.commit();
  }

  return { createdItems };
}

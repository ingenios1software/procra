import type { AsientoDiario, PlanDeCuenta } from "@/lib/types";
import { getSaldoSegunNaturaleza } from "@/lib/contabilidad/asientos";

type AccountTotals = {
  totalDebe: number;
  totalHaber: number;
};

export type EvolucionPatrimonialRubroKey =
  | "capital_social"
  | "revaluo_bienes"
  | "reserva_legal"
  | "aporte_agro_industrial"
  | "retiro_dividendos"
  | "resultado_ejerc_anterior"
  | "otros_patrimonios";

export type EvolucionPatrimonialCuentaOverride = {
  rubroKey?: EvolucionPatrimonialRubroKey | null;
  ignorar?: boolean;
};

export type EvolucionPatrimonialCuentaResolvedMapping = {
  rubroKey: EvolucionPatrimonialRubroKey | null;
  incluirEnInforme: boolean;
  esCapitalBase: boolean;
  origen: "auto" | "manual";
  label: string;
};

type RubroDefinition = {
  key: EvolucionPatrimonialRubroKey;
  label: string;
  hints: string[];
  esCapitalBase?: boolean;
};

export type EvolucionPatrimonialRubro = {
  key: EvolucionPatrimonialRubroKey;
  label: string;
  saldoPYG: number;
  saldoUSD: number | null;
  esCapitalBase: boolean;
};

export type EvolucionPatrimonialCuenta = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  saldoPYG: number;
  esCapitalBase: boolean;
  rubroKey: EvolucionPatrimonialRubroKey;
  origenMapeo: "auto" | "manual";
};

export type EvolucionPatrimonialAnual = {
  anio: number;
  activoPYG: number;
  pasivoPYG: number;
  patrimonioNetoContablePYG: number;
  patrimonioCuentasPYG: number;
  resultadoEjercicioPYG: number;
  capitalActualPYG: number;
  patrimonioNetoPYG: number;
  capitalBasePYG: number | null;
  incrementoSobreCapitalPYG: number | null;
  incrementoSobreCapitalPct: number | null;
  variacionInteranualPYG: number | null;
  variacionInteranualPct: number | null;
  tipoCambioPYGPorUSD: number | null;
  capitalActualUSD: number | null;
  patrimonioNetoUSD: number | null;
  capitalBaseUSD: number | null;
  resultadoEjercicioUSD: number | null;
  incrementoSobreCapitalUSD: number | null;
  conciliacionDiferenciaPYG: number;
  rubrosPatrimoniales: EvolucionPatrimonialRubro[];
  cuentasPatrimoniales: EvolucionPatrimonialCuenta[];
};

export type EvolucionPatrimonialReporte = {
  resumenes: EvolucionPatrimonialAnual[];
  rubrosPatrimoniales: Array<{
    key: EvolucionPatrimonialRubroKey;
    label: string;
    esCapitalBase: boolean;
  }>;
  cuentasPatrimoniales: Array<{
    cuentaId: string;
    codigo: string;
    nombre: string;
    esCapitalBase: boolean;
    rubroKey: EvolucionPatrimonialRubroKey;
    origenMapeo: "auto" | "manual";
  }>;
  capitalBaseDetectado: boolean;
};

const MONEY_TOLERANCE = 0.005;

const RUBRO_DEFINITIONS: RubroDefinition[] = [
  {
    key: "capital_social",
    label: "Capital Social",
    esCapitalBase: true,
    hints: ["capital social", "capital integrado", "capital suscripto", "capital"],
  },
  {
    key: "revaluo_bienes",
    label: "Revaluo de bienes",
    hints: ["revaluo", "revaluacion", "revaluacion de bienes", "revaluo de bienes"],
  },
  {
    key: "reserva_legal",
    label: "Reserva Legal",
    hints: ["reserva legal"],
  },
  {
    key: "aporte_agro_industrial",
    label: "Aporte Agro Industrial",
    hints: ["aporte agro", "agro industrial", "aporte industrial"],
  },
  {
    key: "retiro_dividendos",
    label: "Retiro de Dividendos",
    hints: ["retiro de dividendos", "retiro dividendos", "dividendos"],
  },
  {
    key: "resultado_ejerc_anterior",
    label: "Resultado Ejerc. Anterior",
    hints: [
      "resultado ejerc anterior",
      "resultado ejercicio anterior",
      "resultados acumulados",
      "resultado acumulado",
      "utilidades acumuladas",
      "ganancias acumuladas",
    ],
  },
  {
    key: "otros_patrimonios",
    label: "Otros patrimonios",
    hints: [],
  },
];

export const EVOLUCION_PATRIMONIAL_RUBROS = RUBRO_DEFINITIONS.map((definition) => ({
  key: definition.key,
  label: definition.label,
  esCapitalBase: Boolean(definition.esCapitalBase),
}));

const CURRENT_RESULT_HINTS = [
  "resultado del ejercicio",
  "resultado del ejerc",
  "utilidad del ejercicio",
  "perdida del ejercicio",
  "perdida ejercicio",
];

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAnyHint(base: string, hints: string[]): boolean {
  return hints.some((hint) => base.includes(hint));
}

function isCurrentResultPatrimonyAccount(cuenta: Pick<PlanDeCuenta, "nombre" | "tipo">): boolean {
  if (cuenta.tipo !== "patrimonio") return false;
  return matchesAnyHint(normalizeText(cuenta.nombre), CURRENT_RESULT_HINTS);
}

function resolvePatrimonioRubro(cuenta: Pick<PlanDeCuenta, "nombre">): RubroDefinition {
  const base = normalizeText(cuenta.nombre);
  const match = RUBRO_DEFINITIONS.find(
    (definition) => definition.key !== "otros_patrimonios" && matchesAnyHint(base, definition.hints)
  );
  return match || RUBRO_DEFINITIONS[RUBRO_DEFINITIONS.length - 1];
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const dateValue = (value as { toDate?: () => Date }).toDate?.();
    return dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function registerMovement(target: Map<string, AccountTotals>, cuentaId: string, tipo: "debe" | "haber", monto: number) {
  const safeMonto = Number(monto) || 0;
  if (Math.abs(safeMonto) <= MONEY_TOLERANCE) return;

  const current = target.get(cuentaId) || { totalDebe: 0, totalHaber: 0 };
  if (tipo === "debe") current.totalDebe += safeMonto;
  if (tipo === "haber") current.totalHaber += safeMonto;
  target.set(cuentaId, current);
}

function computeSaldo(cuenta: Pick<PlanDeCuenta, "naturaleza">, totals: AccountTotals | undefined): number {
  if (!totals) return 0;
  return roundMoney(getSaldoSegunNaturaleza(cuenta, totals.totalDebe, totals.totalHaber));
}

function getRubroDefinition(key: EvolucionPatrimonialRubroKey): RubroDefinition {
  return RUBRO_DEFINITIONS.find((definition) => definition.key === key)!;
}

export function resolveEvolucionPatrimonialCuentaMapping(
  cuenta: Pick<PlanDeCuenta, "nombre" | "tipo">,
  override?: EvolucionPatrimonialCuentaOverride | null
): EvolucionPatrimonialCuentaResolvedMapping {
  if (cuenta.tipo !== "patrimonio") {
    return {
      rubroKey: null,
      incluirEnInforme: false,
      esCapitalBase: false,
      origen: override ? "manual" : "auto",
      label: "No patrimonial",
    };
  }

  if (override?.ignorar) {
    return {
      rubroKey: null,
      incluirEnInforme: false,
      esCapitalBase: false,
      origen: "manual",
      label: "Excluir del informe",
    };
  }

  if (override?.rubroKey) {
    const definition = getRubroDefinition(override.rubroKey);
    return {
      rubroKey: definition.key,
      incluirEnInforme: true,
      esCapitalBase: Boolean(definition.esCapitalBase),
      origen: "manual",
      label: definition.label,
    };
  }

  if (isCurrentResultPatrimonyAccount(cuenta)) {
    return {
      rubroKey: null,
      incluirEnInforme: false,
      esCapitalBase: false,
      origen: "auto",
      label: "Excluida: resultado del ejercicio",
    };
  }

  const definition = resolvePatrimonioRubro(cuenta);
  return {
    rubroKey: definition.key,
    incluirEnInforme: true,
    esCapitalBase: Boolean(definition.esCapitalBase),
    origen: "auto",
    label: definition.label,
  };
}

function buildRubrosPatrimoniales(
  rubroSums: Map<EvolucionPatrimonialRubroKey, number>,
  tipoCambioPYGPorUSD: number | null
): EvolucionPatrimonialRubro[] {
  return RUBRO_DEFINITIONS.map((definition) => {
    const saldoPYG = roundMoney(rubroSums.get(definition.key) || 0);
    const saldoUSD =
      tipoCambioPYGPorUSD && tipoCambioPYGPorUSD > 0 ? roundMoney(saldoPYG / tipoCambioPYGPorUSD) : null;

    return {
      key: definition.key,
      label: definition.label,
      saldoPYG,
      saldoUSD,
      esCapitalBase: Boolean(definition.esCapitalBase),
    };
  });
}

function finalizeYearSummary(params: {
  anio: number;
  planById: Map<string, PlanDeCuenta>;
  cumulativeTotals: Map<string, AccountTotals>;
  annualTotals: Map<string, AccountTotals>;
  tasasCambioPorAnio: Map<number, number>;
  cuentaOverrides: Record<string, EvolucionPatrimonialCuentaOverride | undefined>;
  resumenAnterior: EvolucionPatrimonialAnual | null;
}): EvolucionPatrimonialAnual {
  const { anio, planById, cumulativeTotals, annualTotals, tasasCambioPorAnio, cuentaOverrides, resumenAnterior } =
    params;

  let activoPYG = 0;
  let pasivoPYG = 0;
  let patrimonioCuentasPYG = 0;
  let resultadoEjercicioPYG = 0;

  const rubroSums = new Map<EvolucionPatrimonialRubroKey, number>();
  RUBRO_DEFINITIONS.forEach((definition) => rubroSums.set(definition.key, 0));

  const cuentasPatrimoniales: EvolucionPatrimonialCuenta[] = [];

  for (const [cuentaId, totals] of cumulativeTotals.entries()) {
    const cuenta = planById.get(cuentaId);
    if (!cuenta) continue;

    const saldo = computeSaldo(cuenta, totals);
    if (Math.abs(saldo) <= MONEY_TOLERANCE) continue;

    if (cuenta.tipo === "activo") activoPYG += saldo;
    if (cuenta.tipo === "pasivo") pasivoPYG += saldo;

    if (cuenta.tipo === "patrimonio") {
      const rubro = resolveEvolucionPatrimonialCuentaMapping(cuenta, cuentaOverrides[cuentaId]);
      if (!rubro.incluirEnInforme || !rubro.rubroKey) continue;

      patrimonioCuentasPYG += saldo;
      rubroSums.set(rubro.rubroKey, roundMoney((rubroSums.get(rubro.rubroKey) || 0) + saldo));
      cuentasPatrimoniales.push({
        cuentaId,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        saldoPYG: saldo,
        esCapitalBase: rubro.esCapitalBase,
        rubroKey: rubro.rubroKey,
        origenMapeo: rubro.origen,
      });
    }
  }

  for (const [cuentaId, totals] of annualTotals.entries()) {
    const cuenta = planById.get(cuentaId);
    if (!cuenta) continue;

    const saldo = computeSaldo(cuenta, totals);
    if (Math.abs(saldo) <= MONEY_TOLERANCE) continue;

    if (cuenta.tipo === "ingreso") resultadoEjercicioPYG += saldo;
    if (cuenta.tipo === "costo" || cuenta.tipo === "gasto") resultadoEjercicioPYG -= saldo;
  }

  cuentasPatrimoniales.sort((a, b) => {
    const rubroCompare = RUBRO_DEFINITIONS.findIndex((item) => item.key === a.rubroKey) -
      RUBRO_DEFINITIONS.findIndex((item) => item.key === b.rubroKey);
    if (rubroCompare !== 0) return rubroCompare;
    const codigoCompare = a.codigo.localeCompare(b.codigo, "es");
    if (codigoCompare !== 0) return codigoCompare;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  activoPYG = roundMoney(activoPYG);
  pasivoPYG = roundMoney(pasivoPYG);
  patrimonioCuentasPYG = roundMoney(patrimonioCuentasPYG);
  resultadoEjercicioPYG = roundMoney(resultadoEjercicioPYG);

  const patrimonioNetoContablePYG = roundMoney(activoPYG - pasivoPYG);
  const capitalActualPYG = roundMoney(patrimonioCuentasPYG + resultadoEjercicioPYG);
  const capitalBasePYG = Math.abs(rubroSums.get("capital_social") || 0) > MONEY_TOLERANCE
    ? roundMoney(rubroSums.get("capital_social") || 0)
    : null;
  const incrementoSobreCapitalPYG =
    capitalBasePYG !== null ? roundMoney(capitalActualPYG - capitalBasePYG) : null;
  const incrementoSobreCapitalPct =
    capitalBasePYG !== null && Math.abs(capitalBasePYG) > MONEY_TOLERANCE
      ? roundMoney((incrementoSobreCapitalPYG! / capitalBasePYG) * 100)
      : null;
  const variacionInteranualPYG = resumenAnterior
    ? roundMoney(capitalActualPYG - resumenAnterior.capitalActualPYG)
    : null;
  const variacionInteranualPct =
    resumenAnterior && Math.abs(resumenAnterior.capitalActualPYG) > MONEY_TOLERANCE
      ? roundMoney((variacionInteranualPYG! / Math.abs(resumenAnterior.capitalActualPYG)) * 100)
      : null;

  const tipoCambioPYGPorUSD = tasasCambioPorAnio.get(anio) ?? null;
  const capitalActualUSD =
    tipoCambioPYGPorUSD && tipoCambioPYGPorUSD > 0 ? roundMoney(capitalActualPYG / tipoCambioPYGPorUSD) : null;
  const capitalBaseUSD =
    tipoCambioPYGPorUSD && tipoCambioPYGPorUSD > 0 && capitalBasePYG !== null
      ? roundMoney(capitalBasePYG / tipoCambioPYGPorUSD)
      : null;
  const resultadoEjercicioUSD =
    tipoCambioPYGPorUSD && tipoCambioPYGPorUSD > 0 ? roundMoney(resultadoEjercicioPYG / tipoCambioPYGPorUSD) : null;
  const incrementoSobreCapitalUSD =
    capitalActualUSD !== null && capitalBaseUSD !== null ? roundMoney(capitalActualUSD - capitalBaseUSD) : null;
  const conciliacionDiferenciaPYG = roundMoney(patrimonioNetoContablePYG - capitalActualPYG);
  const rubrosPatrimoniales = buildRubrosPatrimoniales(rubroSums, tipoCambioPYGPorUSD);

  return {
    anio,
    activoPYG,
    pasivoPYG,
    patrimonioNetoContablePYG,
    patrimonioCuentasPYG,
    resultadoEjercicioPYG,
    capitalActualPYG,
    patrimonioNetoPYG: capitalActualPYG,
    capitalBasePYG,
    incrementoSobreCapitalPYG,
    incrementoSobreCapitalPct,
    variacionInteranualPYG,
    variacionInteranualPct,
    tipoCambioPYGPorUSD,
    capitalActualUSD,
    patrimonioNetoUSD: capitalActualUSD,
    capitalBaseUSD,
    resultadoEjercicioUSD,
    incrementoSobreCapitalUSD,
    conciliacionDiferenciaPYG,
    rubrosPatrimoniales,
    cuentasPatrimoniales,
  };
}

export function buildEvolucionPatrimonialReporte(params: {
  asientos: AsientoDiario[] | null | undefined;
  planDeCuentas: PlanDeCuenta[] | null | undefined;
  tasasCambioPorAnio: Map<number, number>;
  cuentaOverrides?: Record<string, EvolucionPatrimonialCuentaOverride | undefined>;
}): EvolucionPatrimonialReporte {
  const { asientos, planDeCuentas, tasasCambioPorAnio, cuentaOverrides = {} } = params;
  const planById = new Map((planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta]));

  const asientosOrdenados = (asientos || [])
    .map((asiento) => ({
      asiento,
      fecha: toDate(asiento.fecha),
    }))
    .filter((row): row is { asiento: AsientoDiario; fecha: Date } => Boolean(row.fecha))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const cumulativeTotals = new Map<string, AccountTotals>();
  const annualTotals = new Map<string, AccountTotals>();
  const resumenes: EvolucionPatrimonialAnual[] = [];

  let currentYear: number | null = null;

  const pushCurrentYear = () => {
    if (currentYear === null) return;

    const resumenAnterior = resumenes.length > 0 ? resumenes[resumenes.length - 1] : null;
    resumenes.push(
      finalizeYearSummary({
        anio: currentYear,
        planById,
        cumulativeTotals,
        annualTotals,
        tasasCambioPorAnio,
        cuentaOverrides,
        resumenAnterior,
      })
    );
    annualTotals.clear();
  };

  for (const { asiento, fecha } of asientosOrdenados) {
    const year = fecha.getFullYear();

    if (currentYear === null) {
      currentYear = year;
    } else if (year !== currentYear) {
      pushCurrentYear();
      currentYear = year;
    }

    for (const movimiento of asiento.movimientos || []) {
      const cuenta = planById.get(movimiento.cuentaId);
      if (!cuenta) continue;

      registerMovement(cumulativeTotals, movimiento.cuentaId, movimiento.tipo, movimiento.monto);
      if (cuenta.tipo === "ingreso" || cuenta.tipo === "costo" || cuenta.tipo === "gasto") {
        registerMovement(annualTotals, movimiento.cuentaId, movimiento.tipo, movimiento.monto);
      }
    }
  }

  pushCurrentYear();

  const rubrosPatrimoniales = RUBRO_DEFINITIONS
    .filter((definition) =>
      definition.key !== "otros_patrimonios" ||
      resumenes.some((resumen) => Math.abs(resumen.rubrosPatrimoniales.find((row) => row.key === definition.key)?.saldoPYG || 0) > MONEY_TOLERANCE)
    )
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      esCapitalBase: Boolean(definition.esCapitalBase),
    }));

  const cuentasPatrimonialesMap = new Map<
    string,
    {
      cuentaId: string;
      codigo: string;
      nombre: string;
      esCapitalBase: boolean;
      rubroKey: EvolucionPatrimonialRubroKey;
      origenMapeo: "auto" | "manual";
    }
  >();

  resumenes.forEach((resumen) => {
    resumen.cuentasPatrimoniales.forEach((cuenta) => {
      cuentasPatrimonialesMap.set(cuenta.cuentaId, {
        cuentaId: cuenta.cuentaId,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        esCapitalBase: cuenta.esCapitalBase,
        rubroKey: cuenta.rubroKey,
        origenMapeo: cuenta.origenMapeo,
      });
    });
  });

  const cuentasPatrimoniales = Array.from(cuentasPatrimonialesMap.values()).sort((a, b) => {
    const rubroCompare =
      RUBRO_DEFINITIONS.findIndex((item) => item.key === a.rubroKey) -
      RUBRO_DEFINITIONS.findIndex((item) => item.key === b.rubroKey);
    if (rubroCompare !== 0) return rubroCompare;
    const codigoCompare = a.codigo.localeCompare(b.codigo, "es");
    if (codigoCompare !== 0) return codigoCompare;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  const capitalBaseDetectado = cuentasPatrimoniales.some((cuenta) => cuenta.esCapitalBase);

  return {
    resumenes,
    rubrosPatrimoniales,
    cuentasPatrimoniales,
    capitalBaseDetectado,
  };
}

export function getRubroLabel(key: EvolucionPatrimonialRubroKey): string {
  return getRubroDefinition(key).label;
}

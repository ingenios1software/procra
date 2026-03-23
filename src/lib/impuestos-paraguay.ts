import { getSaldoSegunNaturaleza } from "@/lib/contabilidad/asientos";
import type { AsientoDiario, CompraNormal, Insumo, PlanDeCuenta, Venta } from "@/lib/types";

export const PARAGUAY_IRE_GENERAL_RATE = 0.1;
export const PARAGUAY_ZAFRA_ALL = "__all__";

export const MESES_CORTOS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export const MESES_LARGOS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export type MonedaTributaria = "PYG" | "USD";
export type TasaIvaKey = "10" | "5" | "0" | "sin_clasificar";

export type BucketIva = {
  key: TasaIvaKey;
  label: string;
  montoBruto: number;
  baseImponible: number;
  impuesto: number;
  lineas: number;
};

export type ResumenIvaLado = {
  documentos: number;
  lineas: number;
  montoBruto: number;
  baseImponible: number;
  impuesto: number;
  montoClasificado: number;
  montoSinClasificar: number;
  lineasSinClasificar: number;
  buckets: Record<TasaIvaKey, BucketIva>;
};

export type ResumenIvaMoneda = {
  moneda: MonedaTributaria;
  ventas: ResumenIvaLado;
  compras: ResumenIvaLado;
  debitoFiscal: number;
  creditoFiscal: number;
  saldoIva: number;
  estado: "a_pagar" | "saldo_a_favor" | "neutro";
};

export type PuntoSerieIva = {
  mes: number;
  label: string;
  debitoFiscal: number;
  creditoFiscal: number;
  saldoIva: number;
};

export type CuentaIreResumen = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: "ingreso" | "costo" | "gasto";
  totalDebe: number;
  totalHaber: number;
  saldo: number;
};

export type ResumenIre = {
  ejercicio: number;
  ingresosNetos: number;
  costosDeducibles: number;
  gastosDeducibles: number;
  resultadoContable: number;
  baseImponible: number;
  tasaIre: number;
  ireEstimado: number;
  estado: "a_pagar" | "sin_impuesto" | "quebranto";
  cuentasIngresos: CuentaIreResumen[];
  cuentasCostos: CuentaIreResumen[];
  cuentasGastos: CuentaIreResumen[];
  monedasComerciales: MonedaTributaria[];
  multimonedaDetectada: boolean;
  movimientosSinCuenta: number;
};

export type PuntoSerieIre = {
  mes: number;
  label: string;
  ingresosNetos: number;
  costosDeducibles: number;
  gastosDeducibles: number;
  resultadoContable: number;
};

type VatAccumulator = {
  documentos: number;
  lineas: number;
  buckets: Record<TasaIvaKey, BucketIva>;
};

type IreAccountAccumulator = {
  cuenta: PlanDeCuenta;
  totalDebe: number;
  totalHaber: number;
};

function redondearMoneda(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toDateSafe(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMonedaTributaria(value: string | undefined | null): value is MonedaTributaria {
  return value === "PYG" || value === "USD";
}

function normalizarTasaIva(value: string | number | undefined | null): 0 | 5 | 10 | null {
  const normalized = String(value ?? "").trim();
  if (normalized === "10" || normalized === "10.0") return 10;
  if (normalized === "5" || normalized === "5.0") return 5;
  if (normalized === "0" || normalized === "0.0") return 0;
  return null;
}

function dividirMontoConIvaIncluido(montoBruto: number, tasa: 0 | 5 | 10): { baseImponible: number; impuesto: number } {
  if (tasa === 0) {
    return {
      baseImponible: redondearMoneda(montoBruto),
      impuesto: 0,
    };
  }

  const divisor = 1 + tasa / 100;
  const baseImponible = montoBruto / divisor;
  const impuesto = montoBruto - baseImponible;

  return {
    baseImponible: redondearMoneda(baseImponible),
    impuesto: redondearMoneda(impuesto),
  };
}

function crearBucket(key: TasaIvaKey, label: string): BucketIva {
  return {
    key,
    label,
    montoBruto: 0,
    baseImponible: 0,
    impuesto: 0,
    lineas: 0,
  };
}

function crearBucketsIva(): Record<TasaIvaKey, BucketIva> {
  return {
    "10": crearBucket("10", "IVA 10%"),
    "5": crearBucket("5", "IVA 5%"),
    "0": crearBucket("0", "Exenta"),
    sin_clasificar: crearBucket("sin_clasificar", "Sin clasificar"),
  };
}

function crearAcumuladorIva(): VatAccumulator {
  return {
    documentos: 0,
    lineas: 0,
    buckets: crearBucketsIva(),
  };
}

function crearResumenIvaVacio(moneda: MonedaTributaria): ResumenIvaMoneda {
  const ventas = finalizarLadoIva(crearAcumuladorIva());
  const compras = finalizarLadoIva(crearAcumuladorIva());

  return {
    moneda,
    ventas,
    compras,
    debitoFiscal: 0,
    creditoFiscal: 0,
    saldoIva: 0,
    estado: "neutro",
  };
}

function agregarLineaIva(accumulator: VatAccumulator, montoBruto: number, tasa: 0 | 5 | 10 | null): void {
  const bruto = redondearMoneda(montoBruto);
  if (bruto <= 0) return;

  accumulator.lineas += 1;

  if (tasa === null) {
    const bucket = accumulator.buckets.sin_clasificar;
    bucket.montoBruto = redondearMoneda(bucket.montoBruto + bruto);
    bucket.lineas += 1;
    return;
  }

  const key = String(tasa) as "10" | "5" | "0";
  const bucket = accumulator.buckets[key];
  const split = dividirMontoConIvaIncluido(bruto, tasa);

  bucket.montoBruto = redondearMoneda(bucket.montoBruto + bruto);
  bucket.baseImponible = redondearMoneda(bucket.baseImponible + split.baseImponible);
  bucket.impuesto = redondearMoneda(bucket.impuesto + split.impuesto);
  bucket.lineas += 1;
}

function finalizarLadoIva(accumulator: VatAccumulator): ResumenIvaLado {
  const orderedKeys: TasaIvaKey[] = ["10", "5", "0", "sin_clasificar"];
  const bucketEntries = orderedKeys.map((key) => [key, accumulator.buckets[key]] as const);

  const montoBruto = redondearMoneda(
    bucketEntries.reduce((sum, [, bucket]) => sum + bucket.montoBruto, 0)
  );
  const baseImponible = redondearMoneda(
    bucketEntries.reduce((sum, [, bucket]) => sum + bucket.baseImponible, 0)
  );
  const impuesto = redondearMoneda(
    bucketEntries.reduce((sum, [, bucket]) => sum + bucket.impuesto, 0)
  );
  const montoSinClasificar = redondearMoneda(accumulator.buckets.sin_clasificar.montoBruto);
  const lineasSinClasificar = accumulator.buckets.sin_clasificar.lineas;

  return {
    documentos: accumulator.documentos,
    lineas: accumulator.lineas,
    montoBruto,
    baseImponible,
    impuesto,
    montoClasificado: redondearMoneda(montoBruto - montoSinClasificar),
    montoSinClasificar,
    lineasSinClasificar,
    buckets: accumulator.buckets,
  };
}

function getVentaItemBruto(item: Venta["items"][number]): number {
  const subtotal = Number(item.subtotal);
  if (Number.isFinite(subtotal)) return redondearMoneda(subtotal);

  const cantidad = Number(item.cantidad) || 0;
  const precioUnitario = Number(item.precioUnitario) || 0;
  const descuentoPorc = Number(item.descuentoPorc) || 0;
  return redondearMoneda(cantidad * precioUnitario * (1 - descuentoPorc / 100));
}

function coincideZafra(zafraId: string | undefined | null, selectedZafraId?: string | null): boolean {
  if (!selectedZafraId || selectedZafraId === PARAGUAY_ZAFRA_ALL) return true;
  return (zafraId || "").trim() === selectedZafraId.trim();
}

function coincidePeriodoMensual(
  fecha: Date | string | undefined | null,
  ejercicio: number,
  mes: number
): boolean {
  const date = toDateSafe(fecha);
  if (!date) return false;
  return date.getFullYear() === ejercicio && date.getMonth() + 1 === mes;
}

function coincideEjercicio(
  fecha: Date | string | undefined | null,
  ejercicio: number
): boolean {
  const date = toDateSafe(fecha);
  if (!date) return false;
  return date.getFullYear() === ejercicio;
}

function buildInsumoIvaMap(insumos: Insumo[] | null | undefined): Map<string, 0 | 5 | 10 | null> {
  return new Map((insumos || []).map((insumo) => [insumo.id, normalizarTasaIva(insumo.iva)]));
}

function buildVatCurrencyAccumulatorMap(): Record<MonedaTributaria, { ventas: VatAccumulator; compras: VatAccumulator }> {
  return {
    PYG: {
      ventas: crearAcumuladorIva(),
      compras: crearAcumuladorIva(),
    },
    USD: {
      ventas: crearAcumuladorIva(),
      compras: crearAcumuladorIva(),
    },
  };
}

export function getMesLabelCorto(mes: number): string {
  return MESES_CORTOS_ES[Math.max(0, Math.min(11, mes - 1))] || "";
}

export function getMesLabelLargo(mes: number): string {
  return MESES_LARGOS_ES[Math.max(0, Math.min(11, mes - 1))] || "";
}

export function getMonedasIvaDisponibles(
  ventas: Venta[] | null | undefined,
  compras: CompraNormal[] | null | undefined,
  ejercicio: number,
  mes: number,
  selectedZafraId?: string | null
): MonedaTributaria[] {
  const currencies = new Set<MonedaTributaria>();

  for (const venta of ventas || []) {
    if (!coincidePeriodoMensual(venta.fecha, ejercicio, mes)) continue;
    if (!coincideZafra(venta.zafraId, selectedZafraId)) continue;
    if (isMonedaTributaria(venta.moneda)) currencies.add(venta.moneda);
  }

  for (const compra of compras || []) {
    if (!coincidePeriodoMensual(compra.fechaEmision, ejercicio, mes)) continue;
    if (!coincideZafra(compra.zafraId, selectedZafraId)) continue;
    if (isMonedaTributaria(compra.moneda)) currencies.add(compra.moneda);
  }

  return Array.from(currencies).sort();
}

export function getEjerciciosIvaDisponibles(
  ventas: Venta[] | null | undefined,
  compras: CompraNormal[] | null | undefined,
  selectedZafraId?: string | null
): number[] {
  const years = new Set<number>();

  for (const venta of ventas || []) {
    if (!coincideZafra(venta.zafraId, selectedZafraId)) continue;
    const date = toDateSafe(venta.fecha);
    if (date) years.add(date.getFullYear());
  }

  for (const compra of compras || []) {
    if (!coincideZafra(compra.zafraId, selectedZafraId)) continue;
    const date = toDateSafe(compra.fechaEmision);
    if (date) years.add(date.getFullYear());
  }

  return Array.from(years).sort((a, b) => a - b);
}

export function getMesesIvaDisponibles(
  ventas: Venta[] | null | undefined,
  compras: CompraNormal[] | null | undefined,
  ejercicio: number,
  selectedZafraId?: string | null
): number[] {
  const months = new Set<number>();

  for (const venta of ventas || []) {
    if (!coincideEjercicio(venta.fecha, ejercicio)) continue;
    if (!coincideZafra(venta.zafraId, selectedZafraId)) continue;
    const date = toDateSafe(venta.fecha);
    if (date) months.add(date.getMonth() + 1);
  }

  for (const compra of compras || []) {
    if (!coincideEjercicio(compra.fechaEmision, ejercicio)) continue;
    if (!coincideZafra(compra.zafraId, selectedZafraId)) continue;
    const date = toDateSafe(compra.fechaEmision);
    if (date) months.add(date.getMonth() + 1);
  }

  return Array.from(months).sort((a, b) => a - b);
}

export function getUltimoPeriodoIva(
  ventas: Venta[] | null | undefined,
  compras: CompraNormal[] | null | undefined,
  selectedZafraId?: string | null
): { ejercicio: number; mes: number } | null {
  let latest: { ejercicio: number; mes: number } | null = null;

  const evaluateDate = (value: Date | string | undefined | null) => {
    const date = toDateSafe(value);
    if (!date) return;
    const candidate = { ejercicio: date.getFullYear(), mes: date.getMonth() + 1 };
    if (!latest) {
      latest = candidate;
      return;
    }
    if (
      candidate.ejercicio > latest.ejercicio ||
      (candidate.ejercicio === latest.ejercicio && candidate.mes > latest.mes)
    ) {
      latest = candidate;
    }
  };

  for (const venta of ventas || []) {
    if (!coincideZafra(venta.zafraId, selectedZafraId)) continue;
    evaluateDate(venta.fecha);
  }

  for (const compra of compras || []) {
    if (!coincideZafra(compra.zafraId, selectedZafraId)) continue;
    evaluateDate(compra.fechaEmision);
  }

  return latest;
}

export function calcularIvaPorMoneda(params: {
  ventas: Venta[] | null | undefined;
  compras: CompraNormal[] | null | undefined;
  insumos: Insumo[] | null | undefined;
  ejercicio: number;
  mes: number;
  selectedZafraId?: string | null;
}): Record<MonedaTributaria, ResumenIvaMoneda> {
  const accumulatorMap = buildVatCurrencyAccumulatorMap();
  const insumoIvaById = buildInsumoIvaMap(params.insumos);

  for (const venta of params.ventas || []) {
    if (!coincidePeriodoMensual(venta.fecha, params.ejercicio, params.mes)) continue;
    if (!coincideZafra(venta.zafraId, params.selectedZafraId)) continue;
    if (!isMonedaTributaria(venta.moneda)) continue;

    const target = accumulatorMap[venta.moneda].ventas;
    target.documentos += 1;

    for (const item of venta.items || []) {
      const bruto = getVentaItemBruto(item);
      const tasa = insumoIvaById.get(item.productoId) ?? null;
      agregarLineaIva(target, bruto, tasa);
    }
  }

  for (const compra of params.compras || []) {
    if (!coincidePeriodoMensual(compra.fechaEmision, params.ejercicio, params.mes)) continue;
    if (!coincideZafra(compra.zafraId, params.selectedZafraId)) continue;
    if (!isMonedaTributaria(compra.moneda)) continue;

    const target = accumulatorMap[compra.moneda].compras;
    target.documentos += 1;

    for (const mercaderia of compra.mercaderias || []) {
      const bruto = redondearMoneda((Number(mercaderia.cantidad) || 0) * (Number(mercaderia.valorUnitario) || 0));
      const tasa = insumoIvaById.get(mercaderia.insumoId) ?? null;
      agregarLineaIva(target, bruto, tasa);
    }

    if ((Number(compra.flete?.valor) || 0) > 0) {
      agregarLineaIva(target, Number(compra.flete?.valor) || 0, null);
    }
  }

  return {
    PYG: (() => {
      const ventas = finalizarLadoIva(accumulatorMap.PYG.ventas);
      const compras = finalizarLadoIva(accumulatorMap.PYG.compras);
      const saldoIva = redondearMoneda(ventas.impuesto - compras.impuesto);
      return {
        moneda: "PYG",
        ventas,
        compras,
        debitoFiscal: ventas.impuesto,
        creditoFiscal: compras.impuesto,
        saldoIva,
        estado: saldoIva > 0 ? "a_pagar" : saldoIva < 0 ? "saldo_a_favor" : "neutro",
      } satisfies ResumenIvaMoneda;
    })(),
    USD: (() => {
      const ventas = finalizarLadoIva(accumulatorMap.USD.ventas);
      const compras = finalizarLadoIva(accumulatorMap.USD.compras);
      const saldoIva = redondearMoneda(ventas.impuesto - compras.impuesto);
      return {
        moneda: "USD",
        ventas,
        compras,
        debitoFiscal: ventas.impuesto,
        creditoFiscal: compras.impuesto,
        saldoIva,
        estado: saldoIva > 0 ? "a_pagar" : saldoIva < 0 ? "saldo_a_favor" : "neutro",
      } satisfies ResumenIvaMoneda;
    })(),
  };
}

export function buildSerieMensualIva(params: {
  ventas: Venta[] | null | undefined;
  compras: CompraNormal[] | null | undefined;
  insumos: Insumo[] | null | undefined;
  ejercicio: number;
  moneda: MonedaTributaria;
  selectedZafraId?: string | null;
}): PuntoSerieIva[] {
  return MESES_CORTOS_ES.map((label, index) => {
    const resumen = calcularIvaPorMoneda({
      ventas: params.ventas,
      compras: params.compras,
      insumos: params.insumos,
      ejercicio: params.ejercicio,
      mes: index + 1,
      selectedZafraId: params.selectedZafraId,
    })[params.moneda] || crearResumenIvaVacio(params.moneda);

    return {
      mes: index + 1,
      label,
      debitoFiscal: resumen.debitoFiscal,
      creditoFiscal: resumen.creditoFiscal,
      saldoIva: resumen.saldoIva,
    };
  });
}

function buildIreRows(params: {
  asientos: AsientoDiario[] | null | undefined;
  planDeCuentas: PlanDeCuenta[] | null | undefined;
  ejercicio: number;
  mes?: number;
  selectedZafraId?: string | null;
}): { rows: CuentaIreResumen[]; movimientosSinCuenta: number } {
  const planById = new Map((params.planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta]));
  const byAccount = new Map<string, IreAccountAccumulator>();
  let movimientosSinCuenta = 0;

  for (const asiento of params.asientos || []) {
    if (!coincideEjercicio(asiento.fecha, params.ejercicio)) continue;
    if (params.mes && !coincidePeriodoMensual(asiento.fecha, params.ejercicio, params.mes)) continue;
    if (!coincideZafra(asiento.zafraId, params.selectedZafraId)) continue;

    for (const movimiento of asiento.movimientos || []) {
      const cuenta = planById.get(movimiento.cuentaId);
      if (!cuenta) {
        movimientosSinCuenta += 1;
        continue;
      }
      if (!["ingreso", "costo", "gasto"].includes(cuenta.tipo)) continue;

      const prev = byAccount.get(cuenta.id) || {
        cuenta,
        totalDebe: 0,
        totalHaber: 0,
      };

      if (movimiento.tipo === "debe") prev.totalDebe += Number(movimiento.monto) || 0;
      if (movimiento.tipo === "haber") prev.totalHaber += Number(movimiento.monto) || 0;
      byAccount.set(cuenta.id, prev);
    }
  }

  const rows = Array.from(byAccount.values())
    .map((item) => ({
      cuentaId: item.cuenta.id,
      codigo: item.cuenta.codigo,
      nombre: item.cuenta.nombre,
      tipo: item.cuenta.tipo as "ingreso" | "costo" | "gasto",
      totalDebe: redondearMoneda(item.totalDebe),
      totalHaber: redondearMoneda(item.totalHaber),
      saldo: redondearMoneda(getSaldoSegunNaturaleza(item.cuenta, item.totalDebe, item.totalHaber)),
    }))
    .filter((item) => item.saldo !== 0)
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
      return b.saldo - a.saldo;
    });

  return {
    rows,
    movimientosSinCuenta,
  };
}

function getMonedasComercialesEjercicio(
  ventas: Venta[] | null | undefined,
  compras: CompraNormal[] | null | undefined,
  ejercicio: number,
  selectedZafraId?: string | null
): MonedaTributaria[] {
  const currencies = new Set<MonedaTributaria>();

  for (const venta of ventas || []) {
    if (!coincideEjercicio(venta.fecha, ejercicio)) continue;
    if (!coincideZafra(venta.zafraId, selectedZafraId)) continue;
    if (isMonedaTributaria(venta.moneda)) currencies.add(venta.moneda);
  }

  for (const compra of compras || []) {
    if (!coincideEjercicio(compra.fechaEmision, ejercicio)) continue;
    if (!coincideZafra(compra.zafraId, selectedZafraId)) continue;
    if (isMonedaTributaria(compra.moneda)) currencies.add(compra.moneda);
  }

  return Array.from(currencies).sort();
}

export function getEjerciciosIreDisponibles(
  asientos: AsientoDiario[] | null | undefined,
  selectedZafraId?: string | null
): number[] {
  const years = new Set<number>();

  for (const asiento of asientos || []) {
    if (!coincideZafra(asiento.zafraId, selectedZafraId)) continue;
    const date = toDateSafe(asiento.fecha);
    if (date) years.add(date.getFullYear());
  }

  return Array.from(years).sort((a, b) => a - b);
}

export function getUltimoEjercicioIre(
  asientos: AsientoDiario[] | null | undefined,
  selectedZafraId?: string | null
): number | null {
  const years = getEjerciciosIreDisponibles(asientos, selectedZafraId);
  return years.length > 0 ? years[years.length - 1] : null;
}

export function calcularIreEstimado(params: {
  asientos: AsientoDiario[] | null | undefined;
  planDeCuentas: PlanDeCuenta[] | null | undefined;
  ventas?: Venta[] | null | undefined;
  compras?: CompraNormal[] | null | undefined;
  ejercicio: number;
  selectedZafraId?: string | null;
  tasaIre?: number;
}): ResumenIre {
  const tasaIre = params.tasaIre ?? PARAGUAY_IRE_GENERAL_RATE;
  const { rows, movimientosSinCuenta } = buildIreRows({
    asientos: params.asientos,
    planDeCuentas: params.planDeCuentas,
    ejercicio: params.ejercicio,
    selectedZafraId: params.selectedZafraId,
  });

  const cuentasIngresos = rows.filter((row) => row.tipo === "ingreso");
  const cuentasCostos = rows.filter((row) => row.tipo === "costo");
  const cuentasGastos = rows.filter((row) => row.tipo === "gasto");

  const ingresosNetos = redondearMoneda(cuentasIngresos.reduce((sum, row) => sum + row.saldo, 0));
  const costosDeducibles = redondearMoneda(cuentasCostos.reduce((sum, row) => sum + row.saldo, 0));
  const gastosDeducibles = redondearMoneda(cuentasGastos.reduce((sum, row) => sum + row.saldo, 0));
  const resultadoContable = redondearMoneda(ingresosNetos - costosDeducibles - gastosDeducibles);
  const baseImponible = redondearMoneda(Math.max(0, resultadoContable));
  const ireEstimado = redondearMoneda(baseImponible * tasaIre);
  const monedasComerciales = getMonedasComercialesEjercicio(
    params.ventas,
    params.compras,
    params.ejercicio,
    params.selectedZafraId
  );

  return {
    ejercicio: params.ejercicio,
    ingresosNetos,
    costosDeducibles,
    gastosDeducibles,
    resultadoContable,
    baseImponible,
    tasaIre,
    ireEstimado,
    estado: resultadoContable > 0 ? "a_pagar" : resultadoContable < 0 ? "quebranto" : "sin_impuesto",
    cuentasIngresos,
    cuentasCostos,
    cuentasGastos,
    monedasComerciales,
    multimonedaDetectada: monedasComerciales.length > 1,
    movimientosSinCuenta,
  };
}

export function buildSerieMensualIre(params: {
  asientos: AsientoDiario[] | null | undefined;
  planDeCuentas: PlanDeCuenta[] | null | undefined;
  ejercicio: number;
  selectedZafraId?: string | null;
}): PuntoSerieIre[] {
  return MESES_CORTOS_ES.map((label, index) => {
    const { rows } = buildIreRows({
      asientos: params.asientos,
      planDeCuentas: params.planDeCuentas,
      ejercicio: params.ejercicio,
      mes: index + 1,
      selectedZafraId: params.selectedZafraId,
    });

    const ingresosNetos = redondearMoneda(
      rows.filter((row) => row.tipo === "ingreso").reduce((sum, row) => sum + row.saldo, 0)
    );
    const costosDeducibles = redondearMoneda(
      rows.filter((row) => row.tipo === "costo").reduce((sum, row) => sum + row.saldo, 0)
    );
    const gastosDeducibles = redondearMoneda(
      rows.filter((row) => row.tipo === "gasto").reduce((sum, row) => sum + row.saldo, 0)
    );
    const resultadoContable = redondearMoneda(ingresosNetos - costosDeducibles - gastosDeducibles);

    return {
      mes: index + 1,
      label,
      ingresosNetos,
      costosDeducibles,
      gastosDeducibles,
      resultadoContable,
    };
  });
}

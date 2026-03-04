import type { EstadoCuentaFinanciera } from "@/lib/types";

const DEFAULT_TOLERANCE = 0.005;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

export type AgingBucket = {
  key: "corriente" | "30" | "60" | "90" | "90mas";
  label: string;
  monto: number;
  cantidad: number;
};

export function toDateSafe(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoSafe(value?: Date | string | null): string | undefined {
  const date = toDateSafe(value);
  return date ? date.toISOString() : undefined;
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function isFormaPagoCredito(value?: string): boolean {
  if (!value) return false;
  const raw = value.toLowerCase().trim();
  if (raw === "credito" || raw === "crédito" || raw === "crÃ©dito") return true;
  const normalized = raw
    .replace(/Ã©/g, "e")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "credito";
}

export function calcularEstadoCuenta(params: {
  montoOriginal: number;
  saldoPendiente: number;
  fechaVencimiento?: Date | string;
  anulada?: boolean;
  tolerance?: number;
}): EstadoCuentaFinanciera {
  const tolerance = params.tolerance ?? DEFAULT_TOLERANCE;
  const montoOriginal = roundMoney(params.montoOriginal);
  const saldoPendiente = roundMoney(params.saldoPendiente);

  if (params.anulada) return "anulada";
  if (saldoPendiente <= tolerance) return "cancelada";

  const vencimiento = toDateSafe(params.fechaVencimiento);
  const now = new Date();
  if (vencimiento && vencimiento.getTime() < now.getTime()) {
    return "vencida";
  }

  const aplicado = roundMoney(montoOriginal - saldoPendiente);
  if (aplicado > tolerance) return "parcial";
  return "abierta";
}

export function calcularSaldoDesdeMovimiento(params: {
  montoOriginal: number;
  montoAplicadoActual: number;
  montoMovimiento: number;
}): { montoAplicado: number; saldoPendiente: number } {
  const montoOriginal = Math.max(0, roundMoney(params.montoOriginal));
  const montoAplicadoActual = Math.max(0, roundMoney(params.montoAplicadoActual));
  const montoMovimiento = Math.max(0, roundMoney(params.montoMovimiento));
  const montoAplicado = Math.min(montoOriginal, roundMoney(montoAplicadoActual + montoMovimiento));
  const saldoPendiente = Math.max(0, roundMoney(montoOriginal - montoAplicado));
  return { montoAplicado, saldoPendiente };
}

export function generarNumeroReciboCobro(date = new Date(), token?: string): string {
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  const base = `RC-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
  if (!token) return base;
  return `${base}-${token.toUpperCase()}`;
}

export function generarNumeroReciboPagoEmpleado(date = new Date(), token?: string): string {
  const yyyy = `${date.getFullYear()}`;
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  const base = `RPE-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
  if (!token) return base;
  return `${base}-${token.toUpperCase()}`;
}

export function calcularAntiguedadSaldos(
  cuentas: Array<{
    saldoPendiente?: number;
    estado?: EstadoCuentaFinanciera | string;
    fechaVencimiento?: Date | string;
  }>,
  referencia = new Date()
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: "corriente", label: "Corriente", monto: 0, cantidad: 0 },
    { key: "30", label: "1-30 dias", monto: 0, cantidad: 0 },
    { key: "60", label: "31-60 dias", monto: 0, cantidad: 0 },
    { key: "90", label: "61-90 dias", monto: 0, cantidad: 0 },
    { key: "90mas", label: "Mas de 90", monto: 0, cantidad: 0 },
  ];

  const refDate = toDateSafe(referencia) || new Date();
  const refDateStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();

  for (const cuenta of cuentas) {
    const saldo = roundMoney(Number(cuenta.saldoPendiente) || 0);
    if (saldo <= DEFAULT_TOLERANCE) continue;
    if (cuenta.estado === "anulada") continue;

    const vencimiento = toDateSafe(cuenta.fechaVencimiento);
    if (!vencimiento) {
      buckets[0].monto = roundMoney(buckets[0].monto + saldo);
      buckets[0].cantidad += 1;
      continue;
    }

    const dueStart = new Date(
      vencimiento.getFullYear(),
      vencimiento.getMonth(),
      vencimiento.getDate()
    ).getTime();
    const diffDays = Math.floor((refDateStart - dueStart) / MILLIS_PER_DAY);

    if (diffDays <= 0) {
      buckets[0].monto = roundMoney(buckets[0].monto + saldo);
      buckets[0].cantidad += 1;
      continue;
    }
    if (diffDays <= 30) {
      buckets[1].monto = roundMoney(buckets[1].monto + saldo);
      buckets[1].cantidad += 1;
      continue;
    }
    if (diffDays <= 60) {
      buckets[2].monto = roundMoney(buckets[2].monto + saldo);
      buckets[2].cantidad += 1;
      continue;
    }
    if (diffDays <= 90) {
      buckets[3].monto = roundMoney(buckets[3].monto + saldo);
      buckets[3].cantidad += 1;
      continue;
    }
    buckets[4].monto = roundMoney(buckets[4].monto + saldo);
    buckets[4].cantidad += 1;
  }

  return buckets;
}

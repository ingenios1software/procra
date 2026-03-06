"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type ReciboPagoEmpleadoViewModel = {
  id: string;
  numero: string;
  empleadoNombre: string;
  empleadoDocumento?: string;
  empleadoPuesto?: string;
  periodoLabel: string;
  fecha: Date | string;
  moneda: "PYG";
  horasLiquidadas: number;
  monto: number;
  estado: "emitido" | "anulado";
  cajaLabel: string;
  observacion?: string;
};

interface ReciboPagoEmpleadoProps {
  recibo: ReciboPagoEmpleadoViewModel;
  className?: string;
}

const RECIBO_COPIES = [
  { key: "trabajador", label: "Copia para el trabajador" },
  { key: "caja", label: "Copia para archivo de caja" },
] as const;

function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy");
}

function formatGs(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return `Gs. ${Math.round(Number(value)).toLocaleString("es-PY")}`;
}

function formatHours(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toLocaleString("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} h`;
}

function estadoClasses(estado: ReciboPagoEmpleadoViewModel["estado"]) {
  if (estado === "anulado") return "border-red-300 text-red-700";
  return "border-emerald-300 text-emerald-700";
}

function TableRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-slate-200 last:border-b-0", className)}>
      <th className="w-[34%] px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </th>
      <td className="px-2.5 py-1.5 text-[13px] font-medium leading-5 text-slate-900">{value || "-"}</td>
    </tr>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="border-b border-slate-300 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
      {children}
    </div>
  );
}

function ReciboPagoEmpleadoSheet({
  recibo,
  copyLabel,
}: {
  recibo: ReciboPagoEmpleadoViewModel;
  copyLabel: string;
}) {
  return (
    <section className="break-inside-avoid border border-slate-400 bg-white p-4 shadow-none sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-dashed border-slate-300 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>{copyLabel}</span>
        <span>Documento interno</span>
      </div>

      <header className="border-b-2 border-slate-300 pb-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Comprobante interno de pago
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
          Comprobante de pago jornalero
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-600">
          Pago de jornales por horas correspondiente al periodo {recibo.periodoLabel}.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="border border-slate-300 px-2 py-1 text-slate-700">Recibo {recibo.numero}</span>
          <span className={cn("border px-2 py-1", estadoClasses(recibo.estado))}>
            {recibo.estado === "anulado" ? "Anulado" : "Emitido"}
          </span>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden border border-slate-300">
          <SectionLabel>Datos del trabajador</SectionLabel>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <TableRow label="Nombre y apellido" value={recibo.empleadoNombre} />
              <TableRow label="Documento" value={recibo.empleadoDocumento || "No registrado"} />
              <TableRow label="Cargo / puesto" value={recibo.empleadoPuesto || "No especificado"} />
              <TableRow label="Horas liquidadas" value={formatHours(recibo.horasLiquidadas)} />
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden border border-slate-300">
          <SectionLabel>Datos del comprobante</SectionLabel>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <TableRow label="Numero de recibo" value={recibo.numero} />
              <TableRow label="Fecha de pago" value={formatDate(recibo.fecha)} />
              <TableRow label="Periodo liquidado" value={recibo.periodoLabel} />
              <TableRow label="Monto neto" value={formatGs(recibo.monto)} />
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-3 overflow-hidden border border-slate-300">
        <SectionLabel>Detalle liquidado</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="w-[42%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Concepto
                </th>
                <th className="w-[26%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Periodo
                </th>
                <th className="w-[14%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Horas
                </th>
                <th className="w-[18%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-2.5 py-2 font-medium text-slate-900">Jornal por horas liquidado</td>
                <td className="px-2.5 py-2 text-slate-700">{recibo.periodoLabel}</td>
                <td className="px-2.5 py-2 text-right text-slate-900">{formatHours(recibo.horasLiquidadas)}</td>
                <td className="px-2.5 py-2 text-right font-semibold text-slate-900">{formatGs(recibo.monto)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300">
                <td className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Caja / origen
                </td>
                <td className="px-2.5 py-2 text-slate-700">{recibo.cajaLabel || "-"}</td>
                <td className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total pagado
                </td>
                <td className="px-2.5 py-2 text-right text-[15px] font-semibold text-slate-950">
                  {formatGs(recibo.monto)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="mt-3 border border-slate-300 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Constancia</p>
        <p className="mt-2 text-[13px] leading-5 text-slate-700">
          Recibi de la administracion la suma de{" "}
          <span className="font-semibold text-slate-950">{formatGs(recibo.monto)}</span> en concepto de jornal por
          horas correspondiente al periodo <span className="font-semibold text-slate-950">{recibo.periodoLabel}</span>.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="border border-slate-200 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Caja / origen</p>
            <p className="mt-1 text-[13px] font-medium text-slate-900">{recibo.cajaLabel || "-"}</p>
          </div>
          <div className="border border-slate-200 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Moneda</p>
            <p className="mt-1 text-[13px] font-medium text-slate-900">{recibo.moneda}</p>
          </div>
          <div className="border border-slate-200 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Estado</p>
            <p className="mt-1 text-[13px] font-medium text-slate-900">
              {recibo.estado === "anulado" ? "Anulado" : "Emitido"}
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[12px] leading-5 text-slate-600">
          <span className="font-semibold text-slate-700">Observaciones:</span>{" "}
          {recibo.observacion || "Sin observaciones registradas."}
        </div>
      </section>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="pt-10 text-center">
          <div className="mx-auto w-[88%] border-b border-slate-500" />
          <p className="mt-2 text-[13px] font-semibold text-slate-900">Entregado por</p>
          <p className="text-[11px] text-slate-500">Responsable de caja / administracion</p>
        </div>
        <div className="pt-10 text-center">
          <div className="mx-auto w-[88%] border-b border-slate-500" />
          <p className="mt-2 text-[13px] font-semibold text-slate-900">Recibi conforme</p>
          <p className="text-[11px] text-slate-500">{recibo.empleadoNombre}</p>
        </div>
      </div>
    </section>
  );
}

export function ReciboPagoEmpleado({ recibo, className }: ReciboPagoEmpleadoProps) {
  return (
    <article className={cn("w-full max-w-[880px] bg-white text-slate-950", className)}>
      <div className="space-y-4">
        {RECIBO_COPIES.map((copy) => (
          <ReciboPagoEmpleadoSheet key={copy.key} recibo={recibo} copyLabel={copy.label} />
        ))}
      </div>
    </article>
  );
}

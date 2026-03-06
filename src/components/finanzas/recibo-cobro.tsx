"use client";

import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";

export type ReciboCobroViewModel = {
  numero: string;
  fecha: string | Date;
  clienteNombre: string;
  documento: string;
  monto: number;
  moneda: "USD" | "PYG";
  cuentaIngreso: string;
  referencia?: string;
  estado?: "emitido" | "anulado";
};

interface ReciboCobroProps {
  recibo: ReciboCobroViewModel;
  className?: string;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy HH:mm");
}

function formatAmount(moneda: ReciboCobroViewModel["moneda"], monto: number) {
  return `${moneda} ${formatCurrency(monto)}`;
}

function estadoClasses(estado: ReciboCobroViewModel["estado"]) {
  if (estado === "anulado") return "border-red-300 text-red-700";
  return "border-emerald-300 text-emerald-700";
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-200 last:border-b-0">
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

export function ReciboCobro({ recibo, className }: ReciboCobroProps) {
  const estado = recibo.estado || "emitido";

  return (
    <article className={cn("w-full max-w-[880px] bg-white text-slate-950", className)}>
      <section className="border border-slate-400 bg-white p-4 shadow-none sm:p-5">
        <header className="border-b-2 border-slate-300 pb-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Comprobante interno de cobro
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
            Recibo de cobro
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-600">
            Constancia de ingreso emitida por el cobro aplicado al documento {recibo.documento}.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="border border-slate-300 px-2 py-1 text-slate-700">Recibo {recibo.numero}</span>
            <span className={cn("border px-2 py-1", estadoClasses(estado))}>
              {estado === "anulado" ? "Anulado" : "Emitido"}
            </span>
          </div>
        </header>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Datos del cliente</SectionLabel>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <TableRow label="Cliente" value={recibo.clienteNombre} />
                <TableRow label="Documento" value={recibo.documento} />
                <TableRow label="Cuenta de ingreso" value={recibo.cuentaIngreso} />
                <TableRow label="Referencia" value={recibo.referencia || "Sin referencia"} />
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Datos del recibo</SectionLabel>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <TableRow label="Numero de recibo" value={recibo.numero} />
                <TableRow label="Fecha de emision" value={formatDate(recibo.fecha)} />
                <TableRow label="Moneda" value={recibo.moneda} />
                <TableRow label="Monto cobrado" value={formatAmount(recibo.moneda, recibo.monto)} />
              </tbody>
            </table>
          </section>
        </div>

        <section className="mt-3 overflow-hidden border border-slate-300">
          <SectionLabel>Detalle del cobro</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="w-[46%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Concepto
                  </th>
                  <th className="w-[22%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Documento
                  </th>
                  <th className="w-[16%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Moneda
                  </th>
                  <th className="w-[16%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="px-2.5 py-2 font-medium text-slate-900">Cobro aplicado a cuenta por cobrar</td>
                  <td className="px-2.5 py-2 text-slate-700">{recibo.documento}</td>
                  <td className="px-2.5 py-2 text-slate-700">{recibo.moneda}</td>
                  <td className="px-2.5 py-2 text-right font-semibold text-slate-900">
                    {formatAmount(recibo.moneda, recibo.monto)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300">
                  <td className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Total cobrado
                  </td>
                  <td className="px-2.5 py-2 text-slate-700">{recibo.documento}</td>
                  <td className="px-2.5 py-2 text-slate-700">{recibo.moneda}</td>
                  <td className="px-2.5 py-2 text-right text-[15px] font-semibold text-slate-950">
                    {formatAmount(recibo.moneda, recibo.monto)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="mt-3 border border-slate-300 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Constancia</p>
          <p className="mt-2 text-[13px] leading-5 text-slate-700">
            Se deja constancia del cobro recibido por la suma de{" "}
            <span className="font-semibold text-slate-950">{formatAmount(recibo.moneda, recibo.monto)}</span>
            {" "}aplicada al documento <span className="font-semibold text-slate-950">{recibo.documento}</span>.
          </p>
          <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[12px] leading-5 text-slate-600">
            <span className="font-semibold text-slate-700">Referencia:</span>{" "}
            {recibo.referencia || "Sin observaciones registradas."}
          </div>
        </section>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="pt-10 text-center">
            <div className="mx-auto w-[88%] border-b border-slate-500" />
            <p className="mt-2 text-[13px] font-semibold text-slate-900">Recibido por</p>
            <p className="text-[11px] text-slate-500">Caja / administracion</p>
          </div>
          <div className="pt-10 text-center">
            <div className="mx-auto w-[88%] border-b border-slate-500" />
            <p className="mt-2 text-[13px] font-semibold text-slate-900">Conforme del cliente</p>
            <p className="text-[11px] text-slate-500">{recibo.clienteNombre}</p>
          </div>
        </div>
      </section>
    </article>
  );
}

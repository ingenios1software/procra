"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (estado === "anulado") return "bg-red-600 text-white";
  return "bg-green-600 text-white";
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/80 bg-background/70 p-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "-"}</p>
    </div>
  );
}

export function ReciboPagoEmpleado({ recibo, className }: ReciboPagoEmpleadoProps) {
  return (
    <article className={cn("w-full max-w-[980px] bg-background text-foreground", className)}>
      <div className="rounded-[28px] border border-border bg-card p-4 shadow-none sm:p-6">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border-0", estadoClasses(recibo.estado))}>
                  {recibo.estado === "anulado" ? "Anulado" : "Emitido"}
                </Badge>
                <Badge variant="outline">Pago de Jornales</Badge>
                <Badge variant="secondary">{recibo.periodoLabel}</Badge>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Recibo de pago de nomina
                </p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
                  Recibo de jornales por horas
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Constancia de pago emitida para {recibo.empleadoNombre}.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Empleado" value={recibo.empleadoNombre} className="border-slate-200 bg-white" />
                <Field
                  label="Documento"
                  value={recibo.empleadoDocumento || "No registrado"}
                  className="border-slate-200 bg-white"
                />
                <Field
                  label="Puesto"
                  value={recibo.empleadoPuesto || "No especificado"}
                  className="border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="w-full max-w-[360px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Recibo</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{recibo.numero}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Interno
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monto abonado</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{formatGs(recibo.monto)}</p>
                <p className="mt-1 text-sm text-slate-600">{formatHours(recibo.horasLiquidadas)}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Fecha" value={formatDate(recibo.fecha)} className="border-slate-200 bg-slate-50" />
                <Field label="Periodo" value={recibo.periodoLabel} className="border-slate-200 bg-slate-50" />
                <Field label="Moneda" value={recibo.moneda} className="border-slate-200 bg-slate-50" />
                <Field label="Estado" value={recibo.estado === "anulado" ? "Anulado" : "Emitido"} className="border-slate-200 bg-slate-50" />
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Detalle de pago</CardTitle>
              <CardDescription>Resumen del pago registrado para el periodo liquidado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Empleado" value={recibo.empleadoNombre} />
              <Field label="Periodo liquidado" value={recibo.periodoLabel} />
              <Field label="Horas liquidadas" value={formatHours(recibo.horasLiquidadas)} />
              <Field label="Monto" value={formatGs(recibo.monto)} />
              <Field label="Caja / origen" value={recibo.cajaLabel || "-"} className="sm:col-span-2" />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Observaciones</CardTitle>
              <CardDescription>Referencia operativa del recibo emitido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Referencia
                </p>
                <p className="mt-2 text-sm leading-6">
                  {recibo.observacion || "Sin observaciones registradas."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="h-16 rounded-md border border-dashed border-slate-300 bg-white" />
            <p className="mt-3 text-sm font-semibold text-slate-900">Entregado por</p>
            <p className="text-xs text-slate-500">Responsable de caja / administracion</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="h-16 rounded-md border border-dashed border-slate-300 bg-white" />
            <p className="mt-3 text-sm font-semibold text-slate-900">Recibi conforme</p>
            <p className="text-xs text-slate-500">{recibo.empleadoNombre}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { collection } from "firebase/firestore";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { getReportBrandingFromEmpresa } from "@/lib/report-branding";
import type { Cultivo, Evento, Insumo, Parcela, Zafra } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EventoComprobanteProps {
  evento: Evento;
  parcela?: Parcela | null;
  cultivo?: Cultivo | null;
  zafra?: Zafra | null;
  className?: string;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy");
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy HH:mm");
}

function formatNumber(value?: number | null, decimals = 2) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-PY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInteger(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-PY", {
    maximumFractionDigits: 0,
  });
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return `USD ${Number(value).toLocaleString("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildDocumentCode(evento: Evento) {
  if (evento.numeroLanzamiento) {
    return `EV-${String(evento.numeroLanzamiento).padStart(6, "0")}`;
  }

  return `EV-${evento.id.slice(0, 6).toUpperCase()}`;
}

function labelTipo(tipo: Evento["tipo"]) {
  const tipoNormalizado = normalizeText(tipo);

  if (tipoNormalizado === "siembra") return "Siembra";
  if (tipoNormalizado === "fertilizacion") return "Fertilizacion";
  if (tipoNormalizado === "riego") return "Riego";
  if (tipoNormalizado === "cosecha") return "Cosecha";
  if (tipoNormalizado === "mantenimiento") return "Mantenimiento";
  if (tipoNormalizado === "plagas") return "Control de plagas";
  if (tipoNormalizado === "aplicacion") return "Aplicacion";
  if (tipoNormalizado === "rendimiento") return "Rendimiento";
  return tipo || "-";
}

function labelEstado(estado: Evento["estado"]) {
  if (estado === "aprobado") return "Aprobado";
  if (estado === "rechazado") return "Rechazado";
  return "Pendiente";
}

function estadoClasses(estado: Evento["estado"]) {
  if (estado === "aprobado") return "bg-green-600 text-white";
  if (estado === "rechazado") return "bg-red-600 text-white";
  return "bg-amber-400 text-black";
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

export function EventoComprobante({
  evento,
  parcela,
  cultivo,
  zafra,
  className,
}: EventoComprobanteProps) {
  const { empresa } = useAuth();
  const firestore = useFirestore();
  const insumosQuery = useMemoFirebase(() => (firestore ? collection(firestore, "insumos") : null), [firestore]);
  const { data: insumos } = useCollection<Insumo>(insumosQuery);
  const reportBranding = useMemo(() => getReportBrandingFromEmpresa(empresa), [empresa]);

  const insumosById = useMemo(() => {
    return new Map((insumos || []).map((insumo) => [insumo.id, insumo]));
  }, [insumos]);

  const productos = useMemo(() => {
    return (evento.productos || []).map((producto) => {
      const insumo = insumosById.get(producto.insumoId);
      return {
        ...producto,
        nombre: insumo?.nombre || producto.insumoId,
        unidad: insumo?.unidad || "-",
        categoria: insumo?.categoria || "-",
      };
    });
  }, [evento.productos, insumosById]);

  const hasClima =
    evento.temperatura !== undefined || evento.humedad !== undefined || evento.viento !== undefined;
  const tipoNormalizado = normalizeText(evento.tipo);
  const esCosecha = tipoNormalizado === "cosecha" || tipoNormalizado === "rendimiento";
  const documentCode = buildDocumentCode(evento);
  const stockStatus = evento.stockProcesadoEn ? "Procesado" : "Pendiente";
  const formalSummary = [
    parcela?.nombre || "Parcela no especificada",
    cultivo?.nombre || "Cultivo no especificado",
    zafra?.nombre || "Zafra no especificada",
  ].join(" / ");

  return (
    <article className={cn("w-full max-w-[1040px] bg-background text-foreground", className)}>
      <div className="rounded-[28px] border border-border bg-card p-4 shadow-none sm:p-6">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border-0", estadoClasses(evento.estado))}>{labelEstado(evento.estado)}</Badge>
                <Badge variant="outline">{labelTipo(evento.tipo)}</Badge>
                <Badge variant="secondary">{stockStatus}</Badge>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Comprobante de ejecucion agricola
                </p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
                  Constancia operativa de evento
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {evento.descripcion || "Sin descripcion registrada."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Parcela / cultivo"
                  value={`${parcela?.nombre || "-"} / ${cultivo?.nombre || "-"}`}
                  className="border-slate-200 bg-white"
                />
                <Field
                  label="Zafra / sector"
                  value={`${zafra?.nombre || "-"} / ${parcela?.sector || "-"}`}
                  className="border-slate-200 bg-white"
                />
                <Field
                  label="Ubicacion"
                  value={parcela?.ubicacion || "No especificada"}
                  className="border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="w-full max-w-[360px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Folio</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{documentCode}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  Interno
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Archivo institucional
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{reportBranding.companyName}</p>
                <p className="mt-1 text-sm text-slate-600">{formalSummary}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Evento" value={`#${evento.numeroLanzamiento || "-"}`} className="border-slate-200 bg-slate-50" />
                <Field
                  label="Item"
                  value={evento.numeroItem ? `Nro. ${evento.numeroItem}` : "-"}
                  className="border-slate-200 bg-slate-50"
                />
                <Field label="Fecha evento" value={formatDate(evento.fecha)} className="border-slate-200 bg-slate-50" />
                <Field
                  label="Emitido"
                  value={formatDateTime(evento.creadoEn as Date | string | null)}
                  className="border-slate-200 bg-slate-50"
                />
              </div>
            </div>
          </div>
        </section>

        {evento.estado === "rechazado" && evento.motivoRechazo && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Motivo de rechazo</p>
            <p className="mt-1 leading-6">{evento.motivoRechazo}</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Datos generales</CardTitle>
              <CardDescription>Identificacion productiva y referencias del lote intervenido.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Parcela" value={parcela?.nombre || "-"} />
              <Field label="Cultivo" value={cultivo?.nombre || "-"} />
              <Field label="Zafra" value={zafra?.nombre || "-"} />
              <Field label="Codigo parcela" value={parcela?.codigo || "-"} />
              <Field
                label="Superficie parcela"
                value={parcela?.superficie ? `${formatNumber(parcela.superficie)} ha` : "-"}
              />
              <Field label="Estado parcela" value={parcela?.estado || "-"} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Resumen economico</CardTitle>
              <CardDescription>Valores de referencia para control administrativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Costo total" value={formatCurrency(evento.costoTotal)} />
              <Field label="Costo por ha" value={formatCurrency(evento.costoPorHa)} />
              <Field label="Servicio total" value={formatCurrency(evento.costoServicioTotal)} />
              <Field label="Cuenta contable" value={evento.cuentaContableId || "-"} />
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Datos tecnicos</CardTitle>
              <CardDescription>Mediciones y referencias registradas durante la labor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Hectareas aplicadas"
                value={evento.hectareasAplicadas ? `${formatNumber(evento.hectareasAplicadas)} ha` : "-"}
              />
              <Field label="Costo servicio/ha" value={formatCurrency(evento.costoServicioPorHa)} />
              {esCosecha ? (
                <>
                  <Field
                    label="Toneladas cosechadas"
                    value={evento.toneladas ? `${formatNumber(evento.toneladas)} ton` : "-"}
                  />
                  <Field label="Precio por tonelada" value={formatCurrency(evento.precioTonelada)} />
                  <Field label="Rendimiento ton/ha" value={formatNumber(evento.rendimientoTonHa)} />
                  <Field label="Rendimiento kg/ha" value={formatInteger(evento.rendimientoKgHa)} />
                </>
              ) : (
                <>
                  <Field label="Adjuntos" value={`${evento.fotos?.length || 0} archivo(s)`} />
                  <Field label="Estado stock" value={stockStatus} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none hover:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Resultado y trazabilidad</CardTitle>
              <CardDescription>Texto operativo y referencias de control del documento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Descripcion del trabajo
                </p>
                <p className="mt-2 text-sm leading-6">{evento.descripcion || "-"}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Resultado informado
                </p>
                <p className="mt-2 text-sm leading-6">{evento.resultado || "Sin observaciones registradas."}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Registrado" value={formatDateTime(evento.creadoEn as Date | string | null)} />
                <Field label="Aprobado" value={formatDateTime(evento.aprobadoEn as Date | string | null)} />
                <Field label="Estado documental" value={labelEstado(evento.estado)} />
                <Field label="Evidencias" value={`${evento.fotos?.length || 0} archivo(s)`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {hasClima && (
          <>
            <Separator className="my-6" />
            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Condiciones climaticas</h3>
                <p className="text-sm text-muted-foreground">Variables registradas durante la ejecucion.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Temperatura"
                  value={evento.temperatura !== undefined ? `${formatNumber(evento.temperatura)} C` : "-"}
                />
                <Field label="Humedad" value={evento.humedad !== undefined ? `${formatNumber(evento.humedad)} %` : "-"} />
                <Field
                  label="Viento"
                  value={evento.viento !== undefined ? `${formatNumber(evento.viento)} km/h` : "-"}
                />
              </div>
            </section>
          </>
        )}

        {productos.length > 0 && (
          <>
            <Separator className="my-6" />
            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Insumos registrados</h3>
                <p className="text-sm text-muted-foreground">Detalle de dosis, categoria y cantidades aplicadas.</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">Insumo</th>
                      <th className="px-4 py-3 font-semibold">Categoria</th>
                      <th className="px-4 py-3 font-semibold">Unidad</th>
                      <th className="px-4 py-3 font-semibold">Dosis/ha</th>
                      <th className="px-4 py-3 font-semibold">Cantidad total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((producto, index) => (
                      <tr key={`${producto.insumoId}-${index}`} className="border-t border-border/80">
                        <td className="px-4 py-3 font-medium">{producto.nombre}</td>
                        <td className="px-4 py-3">{producto.categoria}</td>
                        <td className="px-4 py-3 uppercase">{producto.unidad}</td>
                        <td className="px-4 py-3">{formatNumber(producto.dosis)}</td>
                        <td className="px-4 py-3">{formatNumber(producto.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <Separator className="my-6" />
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Constancia documental
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Este comprobante deja constancia de la actividad registrada en campo para fines de control
              operativo, seguimiento tecnico y archivo administrativo.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Documento" value={documentCode} className="border-slate-200 bg-white" />
              <Field label="Tipo de evento" value={labelTipo(evento.tipo)} className="border-slate-200 bg-white" />
              <Field label="Stock / trazabilidad" value={stockStatus} className="border-slate-200 bg-white" />
              <Field
                label="Fecha de aprobacion"
                value={formatDateTime(evento.aprobadoEn as Date | string | null)}
                className="border-slate-200 bg-white"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Validacion y firmas
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="h-10 border-b border-dashed border-slate-300" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Responsable operativo
                </p>
                <p className="mt-1 text-sm text-slate-700">Firma y aclaracion del encargado de campo.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="h-10 border-b border-dashed border-slate-300" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Supervision / conformidad
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {evento.estado === "aprobado"
                    ? "Evento con aprobacion registrada en el sistema."
                    : "Espacio reservado para validacion del responsable."}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="h-10 border-b border-dashed border-slate-300" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Archivo / recepcion
                </p>
                <p className="mt-1 text-sm text-slate-700">{reportBranding.companyName}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

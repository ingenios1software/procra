"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useTenantSelection } from "@/hooks/use-tenant-selection";
import { getReportBrandingFromEmpresa } from "@/lib/report-branding";
import type { Cultivo, Evento, Insumo, Maquinaria, Parcela, Zafra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

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
  if (estado === "aprobado") return "border-emerald-300 text-emerald-700";
  if (estado === "rechazado") return "border-red-300 text-red-700";
  return "border-amber-300 text-amber-700";
}

type InfoRow = {
  label: string;
  value: string;
};

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
      <th className="w-[38%] px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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

function InfoTable({ rows, className }: { rows: InfoRow[]; className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)}>
      <tbody>
        {rows.map((row) => (
          <TableRow key={row.label} label={row.label} value={row.value} />
        ))}
      </tbody>
    </table>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-300 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-slate-950">{value || "-"}</p>
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
  const { empresa: selectedEmpresa } = useTenantSelection();
  const tenant = useTenantFirestore();
  const insumosQuery = useMemoFirebase(() => tenant.collection("insumos"), [tenant]);
  const { data: insumos } = useCollection<Insumo>(insumosQuery);
  const maquinariaQuery = useMemoFirebase(() => tenant.collection("maquinaria"), [tenant]);
  const { data: maquinarias } = useCollection<Maquinaria>(maquinariaQuery);
  const reportBranding = useMemo(() => getReportBrandingFromEmpresa(selectedEmpresa || empresa), [empresa, selectedEmpresa]);

  const insumosById = useMemo(() => {
    return new Map((insumos || []).map((insumo) => [insumo.id, insumo]));
  }, [insumos]);
  const maquinariasById = useMemo(() => {
    return new Map((maquinarias || []).map((maquinaria) => [maquinaria.id, maquinaria]));
  }, [maquinarias]);

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
  const maquinaria = evento.maquinariaId ? maquinariasById.get(evento.maquinariaId) : undefined;

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
  const contextoRows: InfoRow[] = [
    { label: "Parcela / cultivo", value: `${parcela?.nombre || "-"} / ${cultivo?.nombre || "-"}` },
    { label: "Zafra / sector", value: `${zafra?.nombre || "-"} / ${parcela?.sector || "-"}` },
    { label: "Ubicacion", value: parcela?.ubicacion || "No especificada" },
    { label: "Archivo institucional", value: reportBranding.companyName },
  ];
  const documentoRows: InfoRow[] = [
    { label: "Folio", value: documentCode },
    { label: "Evento", value: `#${evento.numeroLanzamiento || "-"}` },
    { label: "Item", value: evento.numeroItem ? `Nro. ${evento.numeroItem}` : "-" },
    { label: "Fecha evento", value: formatDate(evento.fecha) },
    { label: "Emitido", value: formatDateTime(evento.creadoEn as Date | string | null) },
    { label: "Estado documental", value: labelEstado(evento.estado) },
  ];
  const detalleRows: InfoRow[] = [
    { label: "Parcela", value: parcela?.nombre || "-" },
    { label: "Cultivo", value: cultivo?.nombre || "-" },
    { label: "Zafra", value: zafra?.nombre || "-" },
    { label: "Codigo parcela", value: parcela?.codigo || "-" },
    {
      label: "Superficie parcela",
      value: parcela?.superficie ? `${formatNumber(parcela.superficie)} ha` : "-",
    },
    { label: "Estado parcela", value: parcela?.estado || "-" },
    {
      label: "Hectareas aplicadas",
      value: evento.hectareasAplicadas ? `${formatNumber(evento.hectareasAplicadas)} ha` : "-",
    },
    { label: "Costo servicio/ha", value: formatCurrency(evento.costoServicioPorHa) },
  ];

  if (esCosecha) {
    detalleRows.push(
      { label: "Toneladas cosechadas", value: evento.toneladas ? `${formatNumber(evento.toneladas)} ton` : "-" },
      { label: "Precio por tonelada", value: formatCurrency(evento.precioTonelada) },
      { label: "Rendimiento ton/ha", value: formatNumber(evento.rendimientoTonHa) },
      { label: "Rendimiento kg/ha", value: formatInteger(evento.rendimientoKgHa) }
    );
  } else {
    detalleRows.push(
      { label: "Adjuntos", value: `${evento.fotos?.length || 0} archivo(s)` },
      { label: "Estado stock", value: stockStatus }
    );
  }

  if (evento.maquinariaId) {
    detalleRows.push(
      { label: "Maquinaria", value: maquinaria?.nombre || "Maquinaria vinculada" },
      { label: "Codigo maquina", value: maquinaria?.numeroItem ? `Item ${maquinaria.numeroItem}` : "-" },
      { label: "Hora anterior", value: formatNumber(evento.horometroAnterior, 1) },
      { label: "Hora actual", value: formatNumber(evento.horometroActual, 1) },
      { label: "Horas trabajadas", value: formatNumber(evento.horasTrabajadas, 1) }
    );
  }

  const trazabilidadRows: InfoRow[] = [
    { label: "Registrado", value: formatDateTime(evento.creadoEn as Date | string | null) },
    { label: "Aprobado", value: formatDateTime(evento.aprobadoEn as Date | string | null) },
    { label: "Stock / trazabilidad", value: stockStatus },
    { label: "Evidencias", value: `${evento.fotos?.length || 0} archivo(s)` },
    { label: "Tipo de evento", value: labelTipo(evento.tipo) },
    { label: "Cuenta contable", value: evento.cuentaContableId || "-" },
  ];
  const climaRows: InfoRow[] = hasClima
    ? [
        {
          label: "Temperatura",
          value: evento.temperatura !== undefined ? `${formatNumber(evento.temperatura)} C` : "-",
        },
        {
          label: "Humedad",
          value: evento.humedad !== undefined ? `${formatNumber(evento.humedad)} %` : "-",
        },
        {
          label: "Viento",
          value: evento.viento !== undefined ? `${formatNumber(evento.viento)} km/h` : "-",
        },
      ]
    : [];
  const metricas = [
    { label: "Costo total", value: formatCurrency(evento.costoTotal) },
    { label: "Costo por ha", value: formatCurrency(evento.costoPorHa) },
    { label: "Servicio total", value: formatCurrency(evento.costoServicioTotal) },
    { label: "Resumen productivo", value: formalSummary },
  ];

  return (
    <article className={cn("w-full max-w-[980px] bg-white text-slate-950", className)}>
      <div className="border border-slate-400 bg-white p-4 shadow-none sm:p-5">
        <header className="border-b-2 border-slate-300 pb-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="border border-slate-300 px-2 py-1 text-slate-700">Documento {documentCode}</span>
            <span className="border border-slate-300 px-2 py-1 text-slate-700">{labelTipo(evento.tipo)}</span>
            <span className={cn("border px-2 py-1", estadoClasses(evento.estado))}>{labelEstado(evento.estado)}</span>
            <span className="border border-slate-300 px-2 py-1 text-slate-700">{stockStatus}</span>
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Comprobante de ejecucion agricola
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
            Constancia operativa de evento
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-600">
            {evento.descripcion || "Sin descripcion registrada."}
          </p>
        </header>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Contexto productivo</SectionLabel>
            <InfoTable rows={contextoRows} />
          </section>

          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Control documental</SectionLabel>
            <InfoTable rows={documentoRows} />
          </section>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {metricas.map((metrica) => (
            <MetricCard key={metrica.label} label={metrica.label} value={metrica.value} />
          ))}
        </div>

        {evento.estado === "rechazado" && evento.motivoRechazo && (
          <div className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Motivo de rechazo</p>
            <p className="mt-1 text-[13px] leading-5">{evento.motivoRechazo}</p>
          </div>
        )}

        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Datos generales y tecnicos</SectionLabel>
            <InfoTable rows={detalleRows} />
          </section>

          <section className="overflow-hidden border border-slate-300">
            <SectionLabel>Resultado y trazabilidad</SectionLabel>
            <div className="border-b border-slate-200 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Descripcion del trabajo
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-700">{evento.descripcion || "-"}</p>
            </div>
            <div className="border-b border-slate-200 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Resultado informado
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-700">
                {evento.resultado || "Sin observaciones registradas."}
              </p>
            </div>
            <InfoTable rows={trazabilidadRows} />
          </section>
        </div>

        {hasClima && (
          <section className="mt-3 overflow-hidden border border-slate-300">
            <SectionLabel>Condiciones climaticas</SectionLabel>
            <InfoTable rows={climaRows} />
          </section>
        )}

        {productos.length > 0 && (
          <section className="mt-3 overflow-hidden border border-slate-300">
            <SectionLabel>Insumos registrados</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Insumo
                    </th>
                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Categoria
                    </th>
                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Unidad
                    </th>
                    <th className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Dosis/ha
                    </th>
                    <th className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Cantidad total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto, index) => (
                    <tr key={`${producto.insumoId}-${index}`} className="border-b border-slate-200 last:border-b-0">
                      <td className="px-2.5 py-2 font-medium text-slate-900">{producto.nombre}</td>
                      <td className="px-2.5 py-2 text-slate-700">{producto.categoria}</td>
                      <td className="px-2.5 py-2 uppercase text-slate-700">{producto.unidad}</td>
                      <td className="px-2.5 py-2 text-right text-slate-900">{formatNumber(producto.dosis)}</td>
                      <td className="px-2.5 py-2 text-right text-slate-900">{formatNumber(producto.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-3 border border-slate-300 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            Constancia documental
          </p>
          <p className="mt-2 text-[13px] leading-5 text-slate-700">
            Este comprobante deja constancia de la actividad registrada en campo para fines de control operativo,
            seguimiento tecnico y archivo administrativo.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MetricCard label="Documento" value={documentCode} />
            <MetricCard label="Tipo de evento" value={labelTipo(evento.tipo)} />
            <MetricCard label="Aprobacion" value={formatDateTime(evento.aprobadoEn as Date | string | null)} />
          </div>
        </section>

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div className="pt-10 text-center">
            <div className="mx-auto w-[88%] border-b border-slate-500" />
            <p className="mt-2 text-[13px] font-semibold text-slate-900">Responsable operativo</p>
            <p className="text-[11px] text-slate-500">Firma y aclaracion del encargado de campo.</p>
          </div>
          <div className="pt-10 text-center">
            <div className="mx-auto w-[88%] border-b border-slate-500" />
            <p className="mt-2 text-[13px] font-semibold text-slate-900">Supervision / conformidad</p>
            <p className="text-[11px] text-slate-500">
              {evento.estado === "aprobado"
                ? "Evento con aprobacion registrada en el sistema."
                : "Espacio reservado para validacion del responsable."}
            </p>
          </div>
          <div className="pt-10 text-center">
            <div className="mx-auto w-[88%] border-b border-slate-500" />
            <p className="mt-2 text-[13px] font-semibold text-slate-900">Archivo / recepcion</p>
            <p className="text-[11px] text-slate-500">{reportBranding.companyName}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

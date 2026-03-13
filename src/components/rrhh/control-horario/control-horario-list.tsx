"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, getMonth, getYear } from "date-fns";
import { addDoc, doc, writeBatch } from "firebase/firestore";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  Printer,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ControlHorario, Deposito, Empleado, Parcela, TipoTrabajo } from "@/lib/types";
import {
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  useUser,
} from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import {
  parseBiometricWorkbook,
  normalizeEmployeeName,
  type BiometricInterval,
} from "@/lib/import/control-horario-biometrico-importer";
import { getEmpleadoCodigo, getEmpleadoEtiqueta, normalizeEmpleadoCodigo } from "@/lib/empleados";
import { defaultReportBranding, type ReportBranding } from "@/lib/report-branding";
import { ControlHorarioForm } from "./control-horario-form";
import { ControlHorarioDashboard } from "./control-horario-dashboard";
import {
  BiometricImportModal,
  type BiometricImportPayload,
  type BiometricImportResult,
} from "./biometric-import-modal";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

interface ControlHorarioListProps {
  registros: ControlHorario[];
  empleados: Empleado[];
  parcelas: Parcela[];
  depositos: Deposito[];
  tiposTrabajo: TipoTrabajo[];
  isLoading: boolean;
  refreshRegistros?: () => void;
}

type RegistroSlots = {
  parcelaId: string;
  tipoTrabajo: string;
  amEntrada: string;
  amSalida: string;
  pmEntrada: string;
  pmSalida: string;
};

type ExportRegistroRow = {
  local: string;
  empleado: string;
  fecha: string;
  parcela: string;
  tipoTrabajo: string;
  amEntrada: string;
  amSalida: string;
  pmEntrada: string;
  pmSalida: string;
  horas: number;
  precioHora: number;
  total: number;
};

function parseRegistroDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getRegistroDateTime(registro: ControlHorario): number {
  const date = parseRegistroDate(registro.fecha);
  return date ? date.getTime() : 0;
}

function formatFecha(value: string): string {
  const parsed = parseRegistroDate(value);
  if (!parsed) return value;
  return format(parsed, "dd/MM/yyyy");
}

function dateToInputValue(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getMinutesBetween(start: string, end: string): number {
  if (!timeRegex.test(start) || !timeRegex.test(end)) return 0;
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : 0;
}

function getRegistroMinutes(registro: ControlHorario): number {
  return registro.actividades.reduce(
    (sum, actividad) => sum + getMinutesBetween(actividad.horaInicio, actividad.horaFin),
    0
  );
}

function getRegistroPrecioHora(registro: ControlHorario): number {
  const value = Number(registro.precioHoraGs ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function formatHours(minutes: number): string {
  return (minutes / 60).toLocaleString("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(amount: number): string {
  return `Gs. ${amount.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getSafeFileName(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "control-horario"
  );
}

function openWhatsApp(text: string): void {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
}

function dateKeyToIso(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toISOString();
}

function getDateKeyFromStoredValue(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = parseRegistroDate(trimmed);
  if (!parsed) return null;
  return format(parsed, "yyyy-MM-dd");
}

function getControlHorarioKey(empleadoId: string, fecha: string): string | null {
  const dateKey = getDateKeyFromStoredValue(fecha);
  if (!empleadoId || !dateKey) return null;
  return `${empleadoId}|${dateKey}`;
}

function getIntervalKey(interval: BiometricInterval): string {
  return `${interval.start}-${interval.end}`;
}

function normalizeLookup(value: string): string {
  return normalizeEmployeeName(value);
}

function getImportedEmployeeReference(params: {
  employeeCode?: string;
  employeeName: string;
  sourceRow: number;
}): string {
  return params.employeeCode?.trim() || params.employeeName?.trim() || `Fila ${params.sourceRow}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPrintableListadoHtml(params: {
  title: string;
  periodLabel: string;
  totalRegistros: number;
  totalHoursLabel: string;
  totalPagarLabel: string;
  rows: ExportRegistroRow[];
  branding: ReportBranding;
}): string {
  const { title, periodLabel, totalRegistros, totalHoursLabel, totalPagarLabel, rows, branding } = params;
  const generatedAt = new Date().toLocaleString("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const safeTitle = escapeHtml(title);
  const safePeriod = escapeHtml(periodLabel);
  const safeTotalHours = escapeHtml(totalHoursLabel);
  const safeTotalPagar = escapeHtml(totalPagarLabel);
  const safeGeneratedAt = escapeHtml(generatedAt);
  const safeCompanyName = escapeHtml(branding.companyName);
  const safeLegalName = branding.legalName ? escapeHtml(branding.legalName) : "";
  const safeRuc = branding.ruc ? escapeHtml(branding.ruc) : "";
  const safeAddress = branding.address ? escapeHtml(branding.address) : "";
  const safeContact = branding.contact ? escapeHtml(branding.contact) : "";
  const safePreparedBy = escapeHtml(branding.preparedBy || "Responsable");
  const safeApprovedBy = escapeHtml(branding.approvedBy || "Aprobado por");
  const safeLogoSrc = branding.logoSrc ? escapeHtml(branding.logoSrc) : "";
  const safeLogoFallbacks = (branding.logoFallbackSrcList || [])
    .map((item) => escapeHtml(item))
    .join(",");
  const employeeGroups = new Map<
    string,
    { empleado: string; registros: number; horas: number; total: number; rows: ExportRegistroRow[] }
  >();

  rows.forEach((row) => {
    const empleadoLabel = row.empleado?.trim() || "N/A";
    const key = normalizeLookup(empleadoLabel) || "n-a";
    const current = employeeGroups.get(key);
    if (!current) {
      employeeGroups.set(key, {
        empleado: empleadoLabel,
        registros: 1,
        horas: row.horas,
        total: row.total,
        rows: [row],
      });
      return;
    }

    current.registros += 1;
    current.horas += row.horas;
    current.total += row.total;
    current.rows.push(row);
    if (current.empleado === "N/A" && empleadoLabel !== "N/A") {
      current.empleado = empleadoLabel;
    }
  });
  let rowNumber = 0;
  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="13" class="empty">Sin registros para el periodo seleccionado.</td></tr>`
      : Array.from(employeeGroups.values())
          .map((group) => {
            const detailRows = group.rows
              .map((row) => {
                rowNumber += 1;
                return `
                  <tr>
                    <td>${rowNumber}</td>
                    <td>${escapeHtml(row.local)}</td>
                    <td>${escapeHtml(row.empleado)}</td>
                    <td>${escapeHtml(row.fecha)}</td>
                    <td>${escapeHtml(row.parcela)}</td>
                    <td>${escapeHtml(row.tipoTrabajo)}</td>
                    <td>${escapeHtml(row.amEntrada)}</td>
                    <td>${escapeHtml(row.amSalida)}</td>
                    <td>${escapeHtml(row.pmEntrada)}</td>
                    <td>${escapeHtml(row.pmSalida)}</td>
                    <td class="num">${row.horas.toLocaleString("es-PY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}</td>
                    <td class="num">${escapeHtml(formatMoney(row.precioHora))}</td>
                    <td class="num">${escapeHtml(formatMoney(row.total))}</td>
                  </tr>`;
              })
              .join("\n");

            return `
              ${detailRows}
              <tr class="employee-subtotal">
                <td colspan="10"><strong>${escapeHtml(group.empleado)}</strong> (${group.registros} registros)</td>
                <td class="num">${group.horas.toLocaleString("es-PY", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
                <td class="num">Subtotal</td>
                <td class="num">${escapeHtml(formatMoney(Math.round(group.total)))}</td>
              </tr>`;
          })
          .join("\n");

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: "Segoe UI", Arial, sans-serif; }
      .report-sheet {
        width: 100%;
        max-width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 0;
        padding: 12px 14px 14px;
        background: #fff;
      }
      .report-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: start;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 10px;
        margin-bottom: 12px;
      }
      .report-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-logo {
        width: 64px;
        height: 64px;
        object-fit: contain;
        border: 1px solid #e5e7eb;
        border-radius: 0;
        padding: 4px;
        background: #fff;
      }
      .brand-name { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
      .brand-line { margin: 2px 0 0; font-size: 10.5px; color: #475569; }
      .report-title { margin: 10px 0 0; font-size: 18px; font-weight: 700; color: #0f172a; }
      .report-period { margin: 4px 0 0; font-size: 11.5px; color: #374151; }
      .report-meta { text-align: right; font-size: 11px; color: #4b5563; border-left: 1px solid #e2e8f0; padding-left: 12px; }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }
      .summary-item {
        border: 1px solid #d1d5db;
        border-radius: 0;
        background: #fff;
        padding: 8px 10px;
      }
      .summary-label { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; }
      .summary-value { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: #0f172a; }
      .section-title {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .03em;
        color: #334155;
      }
      table { width: 100%; border-collapse: collapse; font-size: 10.8px; }
      th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; font-weight: 700; color: #0f172a; }
      td.num, th.num { text-align: right; white-space: nowrap; }
      .employee-subtotal td { background: #f8fafc; font-weight: 700; }
      tfoot td { background: #f8fafc; font-weight: 700; border-top: 1px solid #cbd5e1; }
      td.empty { text-align: center; color: #6b7280; padding: 18px 8px; }
      tbody tr:nth-child(even) { background: #fcfcfd; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr, td, th { page-break-inside: avoid; break-inside: avoid; }
      .report-footer {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
      }
      .signature-box {
        border: 0;
        border-top: 1px solid #94a3b8;
        border-radius: 0;
        padding: 8px 0 0;
        min-height: auto;
      }
      .signature-line { display: none; }
      .signature-label { margin: 6px 0 0; font-size: 10.5px; color: #475569; }
      .signature-name { margin: 2px 0 0; font-size: 11.5px; font-weight: 700; color: #0f172a; }
    </style>
  </head>
  <body>
    <main id="report-sheet" class="report-sheet">
      <header class="report-header">
        <div>
          <div class="report-brand">
            ${
              safeLogoSrc
                ? `<img
                    src="${safeLogoSrc}"
                    alt="Logo"
                    class="brand-logo"
                    data-fallbacks="${safeLogoFallbacks}"
                    data-fallback-index="0"
                    onerror="(function(img){var list=(img.getAttribute('data-fallbacks')||'').split(',').filter(Boolean);var idx=Number(img.getAttribute('data-fallback-index')||'0');if(idx<list.length){img.src=list[idx];img.setAttribute('data-fallback-index', String(idx+1));return;}img.style.display='none';})(this);"
                  />`
                : ""
            }
            <div>
              <p class="brand-name">${safeCompanyName}</p>
              ${safeLegalName ? `<p class="brand-line">${safeLegalName}</p>` : ""}
              ${safeRuc ? `<p class="brand-line">${safeRuc}</p>` : ""}
              ${safeAddress ? `<p class="brand-line">${safeAddress}</p>` : ""}
              ${safeContact ? `<p class="brand-line">${safeContact}</p>` : ""}
            </div>
          </div>
          <h1 class="report-title">${safeTitle}</h1>
          <p class="report-period">Periodo: ${safePeriod}</p>
        </div>
        <div class="report-meta">
          <div><strong>Documento:</strong> Control Horario</div>
          <div><strong>Generado:</strong> ${safeGeneratedAt}</div>
        </div>
      </header>
      <section class="summary-grid">
        <article class="summary-item">
          <p class="summary-label">Registros</p>
          <p class="summary-value">${totalRegistros}</p>
        </article>
        <article class="summary-item">
          <p class="summary-label">Horas Totales</p>
          <p class="summary-value">${safeTotalHours}</p>
        </article>
        <article class="summary-item">
          <p class="summary-label">Total a Pagar</p>
          <p class="summary-value">${safeTotalPagar}</p>
        </article>
      </section>
      <section>
        <h2 class="section-title">Detalle de Registros</h2>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>LOCAL</th>
              <th>EMPLEADO / ID</th>
              <th>Fecha</th>
              <th>PARCELA</th>
              <th>TIPO DE TRABAJO</th>
              <th>AM Ent.</th>
              <th>AM Sal.</th>
              <th>PM Ent.</th>
              <th>PM Sal.</th>
              <th class="num">Horas</th>
              <th class="num">Precio Hora</th>
              <th class="num">Total Horas</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="10" class="num">Total general (${totalRegistros} registros)</td>
              <td class="num">${safeTotalHours}</td>
              <td class="num">Total</td>
              <td class="num">${safeTotalPagar}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <footer class="report-footer">
        <section class="signature-box">
          <span class="signature-line"></span>
          <p class="signature-label">Elaborado por</p>
          <p class="signature-name">${safePreparedBy}</p>
        </section>
        <section class="signature-box">
          <span class="signature-line"></span>
          <p class="signature-label">Aprobado por</p>
          <p class="signature-name">${safeApprovedBy}</p>
        </section>
      </footer>
    </main>
  </body>
</html>`;
}

function getRegistroSlots(registro: ControlHorario): RegistroSlots {
  const sorted = [...registro.actividades].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const first = sorted[0];
  const second = sorted[1];

  const tipoTrabajo = registro.tipoTrabajo?.trim() || first?.descripcion?.trim() || "";
  const parcelaId = first?.parcelaId ?? "";

  return {
    parcelaId,
    tipoTrabajo,
    amEntrada: first?.horaInicio ?? "",
    amSalida: first?.horaFin ?? "",
    pmEntrada: second?.horaInicio ?? "",
    pmSalida: second?.horaFin ?? "",
  };
}

export function ControlHorarioList({
  registros,
  empleados,
  parcelas,
  depositos,
  tiposTrabajo,
  isLoading,
  refreshRegistros,
}: ControlHorarioListProps) {
  const tenant = useTenantFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const currentDate = new Date();
  const currentMonth = getMonth(currentDate);
  const currentYear = getYear(currentDate);

  const [rangeFrom, setRangeFrom] = useState<Date>(
    () => new Date(currentYear, currentMonth, 1)
  );
  const [rangeTo, setRangeTo] = useState<Date>(
    () => new Date(currentYear, currentMonth, currentDate.getDate())
  );
  const [isFormOpen, setFormOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ControlHorario | null>(null);
  const [collapsedGroupRows, setCollapsedGroupRows] = useState<Set<string>>(new Set());
  const [showDashboard, setShowDashboard] = useState(false);
  const registrosByKeyRef = useRef<Map<string, ControlHorario>>(new Map());

  const totalColumns = user ? 13 : 12;

  const years = useMemo(() => {
    const fromData = registros
      .map((registro) => parseRegistroDate(registro.fecha))
      .filter((date): date is Date => date !== null)
      .map((date) => getYear(date));
    const unique = new Set<number>([currentYear, ...fromData]);
    return Array.from(unique).sort((a, b) => b - a);
  }, [currentYear, registros]);
  const matrixDefaultMonth = getMonth(rangeFrom);
  const matrixDefaultYear = getYear(rangeFrom);

  const rangeStart = useMemo(
    () => new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate(), 0, 0, 0, 0),
    [rangeFrom]
  );
  const rangeEnd = useMemo(
    () => new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate(), 23, 59, 59, 999),
    [rangeTo]
  );
  const invalidDateRange = rangeStart.getTime() > rangeEnd.getTime();

  const filteredRegistros = useMemo(() => {
    if (invalidDateRange) return [];
    return registros.filter((registro) => {
      const date = parseRegistroDate(registro.fecha);
      if (!date) return false;
      const time = date.getTime();
      return time >= rangeStart.getTime() && time <= rangeEnd.getTime();
    });
  }, [invalidDateRange, rangeEnd, rangeStart, registros]);

  const employeeLookup = useMemo(() => {
    const lookup = new Map<string, Empleado>();
    empleados.forEach((empleado) => {
      const codigo = normalizeEmpleadoCodigo(empleado.codigo);
      if (codigo) {
        lookup.set(codigo, empleado);
      }
    });
    return lookup;
  }, [empleados]);

  const empleadoLabelLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    empleados.forEach((empleado) => {
      lookup.set(empleado.id, getEmpleadoEtiqueta(empleado));
    });
    return lookup;
  }, [empleados]);

  const parcelaLookup = useMemo(() => {
    const lookup = new Map<string, Parcela>();
    parcelas.forEach((parcela) => {
      lookup.set(normalizeLookup(parcela.nombre), parcela);
    });
    return lookup;
  }, [parcelas]);

  const depositoLookup = useMemo(() => {
    const lookup = new Map<string, Deposito>();
    depositos.forEach((deposito) => {
      lookup.set(normalizeLookup(deposito.nombre), deposito);
    });
    return lookup;
  }, [depositos]);

  const getEmpleado = (empleadoId: string) => empleados.find((item) => item.id === empleadoId);

  const getEmpleadoNombre = (empleadoId: string) => {
    const empleado = getEmpleado(empleadoId);
    return empleado ? getEmpleadoEtiqueta(empleado) : empleadoId || "N/A";
  };

  const getParcelaNombre = (parcelaId: string) => {
    if (!parcelaId) return "N/A";
    const parcela = parcelas.find((item) => item.id === parcelaId);
    return parcela?.nombre || "N/A";
  };

  const getDepositoNombre = (depositoId?: string) => {
    if (!depositoId) return undefined;
    const deposito = depositos.find((item) => item.id === depositoId);
    return deposito?.nombre;
  };

  useEffect(() => {
    const next = new Map<string, ControlHorario>();
    registros.forEach((registro) => {
      const key = getControlHorarioKey(registro.empleadoId, registro.fecha);
      if (!key) return;
      next.set(key, registro);
    });
    registrosByKeyRef.current = next;
  }, [registros]);

  const groupedRegistros = useMemo(() => {
    const grouped = new Map<
      string,
      {
        empleadoId: string;
        nombre: string;
        registros: ControlHorario[];
        totalMinutes: number;
        totalPagar: number;
      }
    >();

    filteredRegistros.forEach((registro) => {
      const empleadoId = registro.empleadoId || "sin-empleado";
      const current = grouped.get(empleadoId) ?? {
        empleadoId,
        nombre: empleadoLabelLookup.get(empleadoId) || empleadoId || "N/A",
        registros: [],
        totalMinutes: 0,
        totalPagar: 0,
      };
      current.registros.push(registro);
      const minutes = getRegistroMinutes(registro);
      const precioHora = getRegistroPrecioHora(registro);
      current.totalMinutes += minutes;
      current.totalPagar += (minutes / 60) * precioHora;
      grouped.set(empleadoId, current);
    });

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        registros: [...group.registros].sort((a, b) => getRegistroDateTime(b) - getRegistroDateTime(a)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [empleadoLabelLookup, filteredRegistros]);

  const periodTotals = useMemo(() => {
    return groupedRegistros.reduce(
      (acc, group) => {
        acc.totalRegistros += group.registros.length;
        acc.totalMinutes += group.totalMinutes;
        acc.totalPagar += group.totalPagar;
        return acc;
      },
      { totalRegistros: 0, totalMinutes: 0, totalPagar: 0 }
    );
  }, [groupedRegistros]);

  const exportRows = useMemo<ExportRegistroRow[]>(() => {
    const parcelaById = new Map(parcelas.map((parcela) => [parcela.id, parcela.nombre]));
    const depositoById = new Map(depositos.map((deposito) => [deposito.id, deposito.nombre]));

    return groupedRegistros.flatMap((group) =>
      group.registros.map((registro) => {
        const slots = getRegistroSlots(registro);
        const parcelaNombre = slots.parcelaId ? parcelaById.get(slots.parcelaId) || "N/A" : "N/A";
        const depositoNombre = registro.depositoId ? depositoById.get(registro.depositoId) : undefined;
        const localLabel = depositoNombre || registro.local?.trim() || parcelaNombre;
        const tipoTrabajo = slots.tipoTrabajo || "N/A";
        const totalMinutes = getRegistroMinutes(registro);
        const precioHora = getRegistroPrecioHora(registro);
        const total = (totalMinutes / 60) * precioHora;

        return {
          local: localLabel,
          empleado: group.nombre,
          fecha: formatFecha(registro.fecha),
          parcela: parcelaNombre,
          tipoTrabajo,
          amEntrada: slots.amEntrada || "-",
          amSalida: slots.amSalida || "-",
          pmEntrada: slots.pmEntrada || "-",
          pmSalida: slots.pmSalida || "-",
          horas: Number((totalMinutes / 60).toFixed(2)),
          precioHora,
          total: Math.round(total),
        };
      })
    );
  }, [depositos, groupedRegistros, parcelas]);

  const allGroupsExpanded =
    groupedRegistros.length > 0 &&
    groupedRegistros.every((group) => !collapsedGroupRows.has(group.empleadoId));

  const findParcelaByImportedName = (rawName?: string): Parcela | undefined => {
    if (!rawName) return undefined;
    const normalized = normalizeLookup(rawName);
    const direct = parcelaLookup.get(normalized);
    if (direct) return direct;

    const tokens = normalized.split(" ").filter((token) => token.length > 1);
    if (tokens.length === 0) return undefined;

    const candidates = parcelas.filter((parcela) => {
      const full = normalizeLookup(parcela.nombre);
      return tokens.every((token) => full.includes(token));
    });

    if (candidates.length === 1) return candidates[0];
    return undefined;
  };

  const findDepositoByImportedLocal = (rawLocal?: string): Deposito | undefined => {
    if (!rawLocal) return undefined;
    const normalized = normalizeLookup(rawLocal);
    const direct = depositoLookup.get(normalized);
    if (direct) return direct;

    const tokens = normalized.split(" ").filter((token) => token.length > 1);
    if (tokens.length === 0) return undefined;

    const candidates = depositos.filter((deposito) => {
      const full = normalizeLookup(deposito.nombre);
      return tokens.every((token) => full.includes(token));
    });

    if (candidates.length === 1) return candidates[0];
    return undefined;
  };

  const handleCreateTipoTrabajo = async (nombreRaw: string): Promise<TipoTrabajo | null> => {
    const tiposTrabajoCol = tenant.collection("tiposTrabajo");
    if (!tiposTrabajoCol) return null;

    const nombre = nombreRaw.trim();
    if (nombre.length < 3) {
      toast({
        variant: "destructive",
        title: "Nombre invalido",
        description: "El tipo de trabajo debe tener al menos 3 caracteres.",
      });
      return null;
    }

    const normalized = normalizeLookup(nombre);
    const existing = tiposTrabajo.find(
      (tipo) => normalizeLookup(tipo.nombre || "") === normalized
    );
    if (existing) {
      return existing;
    }

    try {
      const data = {
        nombre,
        activo: true,
      };
      const docRef = await addDoc(tiposTrabajoCol, data);
      const created: TipoTrabajo = { id: docRef.id, ...data };

      toast({
        title: "Tipo de trabajo creado",
        description: `"${nombre}" ya esta disponible en el selector.`,
      });

      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el tipo de trabajo.";
      toast({
        variant: "destructive",
        title: "Error al crear tipo de trabajo",
        description: message,
      });
      return null;
    }
  };

  const findEmpleadoByImportedCode = (rawCode?: string): Empleado | undefined => {
    const normalized = normalizeEmpleadoCodigo(rawCode);
    if (!normalized) return undefined;
    return employeeLookup.get(normalized);
  };

  const handleBiometricImport = async (
    payload: BiometricImportPayload
  ): Promise<BiometricImportResult> => {
    if (!tenant.isReady || !tenant.firestore) {
      return {
        success: false,
        summary: "No hay conexion activa con Firestore.",
        errors: ["Firestore no esta inicializado."],
      };
    }

    try {
      const parsed = await parseBiometricWorkbook(payload.file, {
        matrixMonth: payload.matrixMonth,
        matrixYear: payload.matrixYear,
      });

      if (parsed.records.length === 0) {
        return {
          success: false,
          summary: "No se detectaron marcaciones validas para importar.",
          errors: parsed.errors,
        };
      }

      const missingEmployeeCodes = new Set<string>();
      const unmatchedEmployeeCodes = new Set<string>();
      const aggregated = new Map<
        string,
        {
          empleadoId: string;
          dateKey: string;
          intervals: BiometricInterval[];
          local?: string;
          parcelaName?: string;
          jobType?: string;
          pricePerHourGs?: number;
        }
      >();

      parsed.records.forEach((record) => {
        const importedEmployeeRef = getImportedEmployeeReference(record);
        const empleado = findEmpleadoByImportedCode(record.employeeCode);
        if (!record.employeeCode?.trim()) {
          missingEmployeeCodes.add(importedEmployeeRef);
          return;
        }
        if (!empleado) {
          unmatchedEmployeeCodes.add(importedEmployeeRef);
          return;
        }

        const key = `${empleado.id}|${record.dateKey}`;
        const current = aggregated.get(key) ?? {
          empleadoId: empleado.id,
          dateKey: record.dateKey,
          intervals: [],
          local: "",
          parcelaName: "",
          jobType: "",
          pricePerHourGs: undefined,
        };

        const merged = [...current.intervals, ...record.intervals];
        const dedupMap = new Map<string, BiometricInterval>();
        merged.forEach((interval) => dedupMap.set(getIntervalKey(interval), interval));

        current.intervals = [...dedupMap.values()].sort((a, b) => a.start.localeCompare(b.start));
        if (!current.local && record.local) current.local = record.local;
        if (!current.parcelaName && record.parcelaName) current.parcelaName = record.parcelaName;
        if (!current.jobType && record.jobType) current.jobType = record.jobType;
        if (!current.pricePerHourGs && record.pricePerHourGs) {
          current.pricePerHourGs = record.pricePerHourGs;
        }
        aggregated.set(key, current);
      });

      if (aggregated.size === 0) {
        return {
          success: false,
          summary: "No se pudo asociar ninguna fila con empleados del sistema.",
          errors: [
            ...parsed.errors,
            ...(missingEmployeeCodes.size > 0
              ? [
                  `Sin ID de empleado en la planilla: ${[...missingEmployeeCodes]
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .join(", ")}`,
                ]
              : []),
            ...(unmatchedEmployeeCodes.size > 0
              ? [
                  `Sin coincidencia de ID de empleado: ${[...unmatchedEmployeeCodes]
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .join(", ")}`,
                ]
              : []),
          ],
        };
      }

      const existingByKey = new Map(registrosByKeyRef.current);
      const existingRecordsGroupedByKey = new Map<string, ControlHorario[]>();
      registros.forEach((registro) => {
        const registroKey = getControlHorarioKey(registro.empleadoId, registro.fecha);
        if (!registroKey) return;
        const current = existingRecordsGroupedByKey.get(registroKey) ?? [];
        current.push(registro);
        existingRecordsGroupedByKey.set(registroKey, current);
      });
      const controlHorarioCol = tenant.collection("controlHorario");
      if (!controlHorarioCol) {
        return {
          success: false,
          summary: "No se pudo resolver la empresa activa para importar.",
          errors: ["La coleccion de control horario no esta disponible."],
        };
      }

      const baseDescription = payload.baseDescription.trim() || "Importado desde reloj biometrico";

      const operations: Array<
        | { type: "create"; id: string; key: string; data: Omit<ControlHorario, "id"> }
        | { type: "update"; id: string; data: Omit<ControlHorario, "id"> }
        | { type: "delete"; id: string; key: string }
      > = [];
      const zeroPriceEntries: string[] = [];

      let created = 0;
      let updated = 0;
      let deletedDuplicates = 0;
      let skipped = 0;

      aggregated.forEach((item, key) => {
        const matchedParcela = findParcelaByImportedName(item.parcelaName);
        const matchedDeposito = findDepositoByImportedLocal(item.local);
        const parcelaId = matchedParcela?.id ?? payload.parcelaId;
        const depositoId = matchedDeposito?.id ?? payload.depositoId;
        const depositoNombre = getDepositoNombre(depositoId);
        const tipoTrabajo = item.jobType?.trim() || baseDescription;
        const precioHoraGs = Math.max(
          0,
          Math.round(Number(item.pricePerHourGs ?? payload.precioHoraGs ?? 0) || 0)
        );
        const local = matchedDeposito?.nombre || item.local?.trim() || depositoNombre || undefined;

        if (precioHoraGs <= 0) {
          zeroPriceEntries.push(`${getEmpleadoNombre(item.empleadoId)} ${item.dateKey}`);
        }

        const activities = item.intervals.map((interval) => ({
          parcelaId,
          horaInicio: interval.start,
          horaFin: interval.end,
          descripcion: tipoTrabajo,
        }));

        const data: Omit<ControlHorario, "id"> = {
          empleadoId: item.empleadoId,
          fecha: dateKeyToIso(item.dateKey),
          depositoId,
          local,
          tipoTrabajo,
          precioHoraGs,
          actividades: activities,
        };

        const existing = existingByKey.get(key);
        if (existing) {
          if (!payload.overwriteExisting) {
            skipped++;
            return;
          }
          operations.push({ type: "update", id: existing.id, data });
          const duplicateRecords = (existingRecordsGroupedByKey.get(key) ?? []).filter(
            (registro) => registro.id !== existing.id
          );
          duplicateRecords.forEach((registro) => {
            operations.push({ type: "delete", id: registro.id, key });
            deletedDuplicates++;
          });
          updated++;
          return;
        }

        const newDocRef = doc(controlHorarioCol);
        operations.push({ type: "create", id: newDocRef.id, key, data });
        existingByKey.set(key, { id: newDocRef.id, ...data });
        created++;
      });

      if (operations.length === 0) {
        return {
          success: false,
          summary: "No hubo cambios para aplicar.",
          errors: [
            ...parsed.errors,
            ...(zeroPriceEntries.length > 0
              ? [
                  `Se importaria con precio por hora 0 en: ${zeroPriceEntries
                    .slice(0, 20)
                    .join(", ")}${zeroPriceEntries.length > 20 ? "..." : ""}`,
                ]
              : []),
            ...(missingEmployeeCodes.size > 0
              ? [
                  `Sin ID de empleado en la planilla: ${[...missingEmployeeCodes]
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .join(", ")}`,
                ]
              : []),
            ...(unmatchedEmployeeCodes.size > 0
              ? [
                  `Sin coincidencia de ID de empleado: ${[...unmatchedEmployeeCodes]
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .join(", ")}`,
                ]
              : []),
          ],
        };
      }

      const BATCH_SIZE = 400;

      let batch = writeBatch(tenant.firestore);
      let writes = 0;

      for (const operation of operations) {
        if (operation.type === "update") {
          const registroRef = tenant.doc("controlHorario", operation.id);
          if (!registroRef) {
            return {
              success: false,
              summary: "No se pudo resolver la empresa activa para importar.",
              errors: ["La referencia de control horario no esta disponible."],
            };
          }
          batch.update(registroRef, operation.data);
        } else if (operation.type === "delete") {
          const registroRef = tenant.doc("controlHorario", operation.id);
          if (!registroRef) {
            return {
              success: false,
              summary: "No se pudo resolver la empresa activa para importar.",
              errors: ["La referencia de control horario no esta disponible."],
            };
          }
          batch.delete(registroRef);
        } else {
          batch.set(doc(controlHorarioCol, operation.id), operation.data);
        }

        writes++;
        if (writes >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(tenant.firestore);
          writes = 0;
        }
      }

      if (writes > 0) {
        await batch.commit();
      }

      operations.forEach((operation) => {
        if (operation.type === "update") {
          const key = getControlHorarioKey(operation.data.empleadoId, operation.data.fecha);
          if (!key) return;
          registrosByKeyRef.current.set(key, { id: operation.id, ...operation.data });
          return;
        }

        if (operation.type === "delete") {
          const current = registrosByKeyRef.current.get(operation.key);
          if (current?.id === operation.id) {
            registrosByKeyRef.current.delete(operation.key);
          }
          return;
        }

        registrosByKeyRef.current.set(operation.key, { id: operation.id, ...operation.data });
      });
      refreshRegistros?.();

      const sourceSheetLabel = parsed.sheetName ? ` Hoja: ${parsed.sheetName}.` : "";
      const summary = `Importacion completada: creados ${created}, actualizados ${updated}, duplicados eliminados ${deletedDuplicates}, omitidos ${skipped}.${sourceSheetLabel}`;
      const errors = [
        ...parsed.errors,
        ...(zeroPriceEntries.length > 0
          ? [
              `Precio por hora 0 aplicado en: ${zeroPriceEntries
                .slice(0, 20)
                .join(", ")}${zeroPriceEntries.length > 20 ? "..." : ""}`,
            ]
          : []),
        ...(missingEmployeeCodes.size > 0
          ? [
              `Sin ID de empleado en la planilla: ${[...missingEmployeeCodes]
                .sort((a, b) => a.localeCompare(b, "es"))
                .join(", ")}`,
            ]
          : []),
        ...(unmatchedEmployeeCodes.size > 0
          ? [
              `Sin coincidencia de ID de empleado: ${[...unmatchedEmployeeCodes]
                .sort((a, b) => a.localeCompare(b, "es"))
                .join(", ")}`,
            ]
          : []),
      ];

      toast({
        title: "Importacion finalizada",
        description: summary,
      });

      return {
        success: true,
        summary,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al importar.";
      return {
        success: false,
        summary: "Error en importacion de reloj biometrico.",
        errors: [message],
      };
    }
  };

  const handleSave = (registroData: Omit<ControlHorario, "id">) => {
    if (selectedRegistro) {
      const registroRef = tenant.doc("controlHorario", selectedRegistro.id);
      if (!registroRef) return;
      updateDocumentNonBlocking(registroRef, registroData);
      const previousKey = getControlHorarioKey(selectedRegistro.empleadoId, selectedRegistro.fecha);
      const nextKey = getControlHorarioKey(registroData.empleadoId, registroData.fecha);
      if (previousKey && previousKey !== nextKey) {
        registrosByKeyRef.current.delete(previousKey);
      }
      if (nextKey) {
        registrosByKeyRef.current.set(nextKey, { id: selectedRegistro.id, ...registroData });
      }
      toast({
        title: "Registro actualizado",
        description: "El registro de control horario fue actualizado correctamente.",
      });
    } else {
      const registroCol = tenant.collection("controlHorario");
      if (!registroCol) return;
      const newDocRef = doc(registroCol);
      setDocumentNonBlocking(newDocRef, registroData, { merge: false });
      const nextKey = getControlHorarioKey(registroData.empleadoId, registroData.fecha);
      if (nextKey) {
        registrosByKeyRef.current.set(nextKey, { id: newDocRef.id, ...registroData });
      }
      toast({
        title: "Registro creado",
        description: "Se registro un nuevo control horario.",
      });
    }

    refreshRegistros?.();
    setFormOpen(false);
    setSelectedRegistro(null);
  };

  const handleDelete = (id: string) => {
    const registroRef = tenant.doc("controlHorario", id);
    if (!registroRef) return;
    const existing = registros.find((item) => item.id === id);
    const existingKey = existing ? getControlHorarioKey(existing.empleadoId, existing.fecha) : null;
    if (existingKey) {
      registrosByKeyRef.current.delete(existingKey);
    }
    deleteDocumentNonBlocking(registroRef);
    refreshRegistros?.();
    toast({
      variant: "destructive",
      title: "Registro eliminado",
      description: "El registro de control horario fue eliminado.",
    });
  };

  const openForm = (registro?: ControlHorario) => {
    setSelectedRegistro(registro || null);
    setFormOpen(true);
  };

  const toggleGroupRow = (empleadoId: string) => {
    setCollapsedGroupRows((prev) => {
      const next = new Set(prev);
      if (next.has(empleadoId)) next.delete(empleadoId);
      else next.add(empleadoId);
      return next;
    });
  };

  const handleExpandAllGroups = () => {
    setCollapsedGroupRows(new Set());
  };

  const handleCollapseAllGroups = () => {
    setCollapsedGroupRows(new Set(groupedRegistros.map((group) => group.empleadoId)));
  };

  const buildListadoReportHtml = () =>
    getPrintableListadoHtml({
      title: "Listado de Control Horario",
      periodLabel: `${format(rangeStart, "dd/MM/yyyy")} al ${format(rangeEnd, "dd/MM/yyyy")}`,
      totalRegistros: periodTotals.totalRegistros,
      totalHoursLabel: `${formatHours(periodTotals.totalMinutes)} h`,
      totalPagarLabel: formatMoney(periodTotals.totalPagar),
      rows: exportRows,
      branding: defaultReportBranding,
    });

  const getReportFileBase = () =>
    getSafeFileName(
      `control-horario_${format(rangeStart, "yyyy-MM-dd")}_${format(rangeEnd, "yyyy-MM-dd")}`
    );

  const waitForDocumentAssets = async (doc: Document): Promise<void> => {
    const images = Array.from(doc.images);
    await Promise.all(
      images.map(async (image) => {
        const maxAttempts = 6;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (image.complete && image.naturalWidth > 0) return;

          await new Promise<void>((resolve) => {
            const done = () => resolve();
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
            window.setTimeout(done, 600);
          });

          if (image.complete && image.naturalWidth > 0) return;
        }
      })
    );
  };

  const printHtmlInIframe = async (html: string): Promise<void> => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "1400px";
    iframe.style.height = "900px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    try {
      iframe.srcdoc = html;
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
      });

      const frameDocument = iframe.contentDocument;
      if (frameDocument?.fonts?.ready) {
        await frameDocument.fonts.ready.catch(() => undefined);
      }
      if (frameDocument) {
        await waitForDocumentAssets(frameDocument);
      }

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) throw new Error("No se pudo abrir el documento de impresion.");
      await new Promise<void>((resolve) => {
        frameWindow.requestAnimationFrame(() => resolve());
      });
      frameWindow.focus();
      frameWindow.print();

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        frameWindow.addEventListener("afterprint", done, { once: true });
        window.setTimeout(done, 2500);
      });
    } finally {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  };

  const printHtmlInNewWindow = async (html: string): Promise<void> => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
    if (!printWindow) {
      throw new Error("El navegador bloqueo la ventana de impresion.");
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if (printWindow.document.readyState === "complete") {
        done();
        return;
      }
      printWindow.addEventListener("load", done, { once: true });
      window.setTimeout(done, 700);
    });

    if (printWindow.document.fonts?.ready) {
      await printWindow.document.fonts.ready.catch(() => undefined);
    }
    await waitForDocumentAssets(printWindow.document);

    printWindow.focus();
    printWindow.print();

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      printWindow.addEventListener("afterprint", done, { once: true });
      window.setTimeout(done, 2500);
    });

    printWindow.close();
  };

  const renderReportCanvas = async (html: string): Promise<HTMLCanvasElement> => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "1400px";
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    try {
      iframe.srcdoc = html;
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
      });

      const frameDocument = iframe.contentDocument;
      if (!frameDocument) {
        throw new Error("No se pudo preparar el documento para exportar.");
      }
      if (frameDocument.fonts?.ready) {
        await frameDocument.fonts.ready.catch(() => undefined);
      }
      await waitForDocumentAssets(frameDocument);

      const target = frameDocument.getElementById("report-sheet") as HTMLElement | null;
      if (!target) throw new Error("No se pudo renderizar el contenido del reporte.");

      const { default: html2canvas } = await import("html2canvas");
      return await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: Math.max(target.scrollWidth, target.clientWidth),
        windowHeight: Math.max(target.scrollHeight, target.clientHeight),
      });
    } finally {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  };

  const handleExportExcel = async () => {
    if (exportRows.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay datos para exportar",
        description: "Ajuste el rango de fechas y vuelva a intentar.",
      });
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const fileBase = getSafeFileName(
        `control-horario_${format(rangeStart, "yyyy-MM-dd")}_${format(rangeEnd, "yyyy-MM-dd")}`
      );
      const resumen = [
        ["Control Horario Diario", ""],
        ["Periodo", `${format(rangeStart, "dd/MM/yyyy")} al ${format(rangeEnd, "dd/MM/yyyy")}`],
        ["Registros", periodTotals.totalRegistros],
        ["Horas de trabajo", formatHours(periodTotals.totalMinutes)],
        ["Total a pagar", formatMoney(periodTotals.totalPagar)],
      ];
      const detalle = exportRows.map((row, index) => ({
        NRO: index + 1,
        LOCAL: row.local,
        "EMPLEADO / ID": row.empleado,
        FECHA: row.fecha,
        PARCELA: row.parcela,
        "TIPO DE TRABAJO": row.tipoTrabajo,
        "AM ENT.": row.amEntrada,
        "AM SAL.": row.amSalida,
        "PM ENT.": row.pmEntrada,
        "PM SAL.": row.pmSalida,
        HORAS: row.horas,
        "PRECIO HORA (GS)": row.precioHora,
        "TOTAL (GS)": row.total,
      }));

      const resumenSheet = XLSX.utils.aoa_to_sheet(resumen);
      resumenSheet["!cols"] = [{ wch: 24 }, { wch: 42 }];

      const detalleSheet = XLSX.utils.json_to_sheet(detalle);
      detalleSheet["!cols"] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 28 },
        { wch: 12 },
        { wch: 18 },
        { wch: 26 },
        { wch: 9 },
        { wch: 9 },
        { wch: 9 },
        { wch: 9 },
        { wch: 9 },
        { wch: 16 },
        { wch: 16 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
      XLSX.utils.book_append_sheet(workbook, detalleSheet, "Detalle");
      XLSX.writeFile(workbook, `${fileBase}.xlsx`);

      toast({
        title: "Excel generado",
        description: `Se exportaron ${exportRows.length} filas.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo exportar a Excel.";
      toast({
        variant: "destructive",
        title: "Error de exportacion",
        description: message,
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
      const reportHtml = buildListadoReportHtml();
      const canvas = await renderReportCanvas(reportHtml);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
        heightLeft -= usableHeight;
      }

      pdf.save(`${getReportFileBase()}.pdf`);

      toast({
        title: "PDF generado",
        description: "El archivo se descargo correctamente.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo exportar a PDF.";
      toast({
        variant: "destructive",
        title: "Error de exportacion",
        description: message,
      });
    }
  };

  const handleShareWhatsApp = async () => {
    const reportHtml = buildListadoReportHtml();
    const messageLines = [
      "*Control Horario Diario*",
      `Periodo: ${format(rangeStart, "dd/MM/yyyy")} al ${format(rangeEnd, "dd/MM/yyyy")}`,
      `Registros: ${periodTotals.totalRegistros}`,
      `Horas: ${formatHours(periodTotals.totalMinutes)} h`,
      `Total: ${formatMoney(periodTotals.totalPagar)}`,
      "",
      "Reporte formal generado en imagen.",
      `URL: ${window.location.href}`,
    ];
    const fallbackText = messageLines.join("\n");

    try {
      const canvas = await renderReportCanvas(reportHtml);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        openWhatsApp(fallbackText);
        return;
      }

      const fileName = `${getReportFileBase()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles && typeof navigator.share === "function") {
        await navigator.share({
          files: [file],
          title: "Control Horario Diario",
          text: fallbackText,
        });
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      openWhatsApp(`${fallbackText}\nImagen descargada. Adjuntala en WhatsApp.`);
    } catch (error) {
      console.error("No se pudo generar la imagen para WhatsApp:", error);
      openWhatsApp(fallbackText);
    }
  };

  const handlePrintListado = async () => {
    const reportHtml = buildListadoReportHtml();

    try {
      await printHtmlInIframe(reportHtml);
    } catch (error) {
      console.error("No se pudo imprimir el reporte:", error);
      try {
        await printHtmlInNewWindow(reportHtml);
      } catch (fallbackError) {
        console.error("No se pudo imprimir con ventana auxiliar:", fallbackError);
        toast({
          variant: "destructive",
          title: "No se pudo imprimir",
          description: "Verifique permisos de ventanas emergentes e intente nuevamente.",
        });
      }
    }
  };

  const tableHeadClass =
    "whitespace-nowrap bg-muted/70 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <>
      <PageHeader
        title="Control Horario Diario"
        description="Complete el formulario manual por columnas AM/PM o importe planillas CSV/Excel."
      >
        {user && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar archivo
            </Button>
            <Button onClick={() => openForm()}>
              <PlusCircle />
              Nuevo Registro
            </Button>
          </div>
        )}
      </PageHeader>

      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Periodo de consulta</CardTitle>
          <CardDescription>Seleccione el rango para listar, imprimir y exportar.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_220px_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Desde
            </label>
            <Input
              type="date"
              value={dateToInputValue(rangeFrom)}
              onChange={(event) => {
                const parsed = inputValueToDate(event.target.value);
                if (parsed) setRangeFrom(parsed);
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hasta
            </label>
            <Input
              type="date"
              value={dateToInputValue(rangeTo)}
              onChange={(event) => {
                const parsed = inputValueToDate(event.target.value);
                if (parsed) setRangeTo(parsed);
              }}
            />
          </div>
          <div className="rounded-xl border border-primary/15 bg-background/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen rapido</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {periodTotals.totalRegistros} registros en el periodo seleccionado
            </p>
            <p className="text-xs text-muted-foreground">
              {format(rangeStart, "dd/MM/yyyy")} al {format(rangeEnd, "dd/MM/yyyy")}
            </p>
          </div>
        </CardContent>
        {invalidDateRange && (
          <div className="px-6 pb-4 text-sm text-destructive">
            El rango es invalido: &quot;Desde&quot; no puede ser mayor a &quot;Hasta&quot;.
          </div>
        )}
      </Card>

      <Card className="mb-6 border-border/70 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>Listado de Registros</CardTitle>
              <CardDescription>
                Mostrando {filteredRegistros.length} registros entre {format(rangeStart, "dd/MM/yyyy")} y{" "}
                {format(rangeEnd, "dd/MM/yyyy")} (agrupado por empleado).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 no-print">
              <Button
                type="button"
                variant="outline"
                onClick={allGroupsExpanded ? handleCollapseAllGroups : handleExpandAllGroups}
                disabled={groupedRegistros.length === 0}
              >
                {allGroupsExpanded ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                {allGroupsExpanded ? "Contraer todo" : "Expandir todo"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDashboard((prev) => !prev)}>
                {showDashboard ? "Ocultar dashboard" : "Mostrar dashboard"}
              </Button>
              <Button type="button" variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button type="button" variant="outline" onClick={handleExportPdf}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button type="button" variant="outline" onClick={handlePrintListado}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
              <Button type="button" variant="outline" onClick={handleShareWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="control-horario-listado-print" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Periodo</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {format(rangeStart, "dd/MM/yyyy")} al {format(rangeEnd, "dd/MM/yyyy")}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total de horas
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatHours(periodTotals.totalMinutes)} h
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total a pagar</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatMoney(periodTotals.totalPagar)}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background">
              <Table className="min-w-[1280px] text-xs md:text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={tableHeadClass}>LOCAL</TableHead>
                    <TableHead className={tableHeadClass}>EMPLEADO / ID</TableHead>
                    <TableHead className={tableHeadClass}>Fecha</TableHead>
                    <TableHead className={tableHeadClass}>PARCELA</TableHead>
                    <TableHead className={tableHeadClass}>TIPO DE TRABAJO</TableHead>
                    <TableHead className={tableHeadClass}>AM Ent.</TableHead>
                    <TableHead className={tableHeadClass}>AM Sal.</TableHead>
                    <TableHead className={tableHeadClass}>PM Ent.</TableHead>
                    <TableHead className={tableHeadClass}>PM Sal.</TableHead>
                    <TableHead className={tableHeadClass}>Horas de Trabajo</TableHead>
                    <TableHead className={tableHeadClass}>PRECIO POR HORAS</TableHead>
                    <TableHead className={tableHeadClass}>Total por Horas</TableHead>
                    {user && <TableHead className={`${tableHeadClass} text-right no-print`}>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={totalColumns} className="py-8 text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && groupedRegistros.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={totalColumns} className="h-24 text-center">
                        {invalidDateRange
                          ? "Rango de fechas invalido."
                          : "No hay registros de control horario en este periodo."}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    groupedRegistros.flatMap((group) => {
                      const isExpanded = !collapsedGroupRows.has(group.empleadoId);
                      const groupHeader = (
                        <TableRow key={`group-${group.empleadoId}`} className="bg-primary/10 hover:bg-primary/10">
                          <TableCell colSpan={9} className="font-semibold">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mr-2 h-7 rounded-md border border-primary/25 bg-background/70 px-2"
                              onClick={() => toggleGroupRow(group.empleadoId)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="mr-1 h-4 w-4" />
                              ) : (
                                <ChevronRight className="mr-1 h-4 w-4" />
                              )}
                              {group.nombre} ({group.registros.length} registros)
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatHours(group.totalMinutes)}</TableCell>
                          <TableCell className="text-right font-semibold">Subtotal</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(group.totalPagar)}</TableCell>
                          {user && <TableCell className="no-print" />}
                        </TableRow>
                      );

                      if (!isExpanded) return [groupHeader];

                      const rows = group.registros.map((registro) => {
                        const precioHora = getRegistroPrecioHora(registro);
                        const totalMinutes = getRegistroMinutes(registro);
                        const totalJornada = (totalMinutes / 60) * precioHora;
                        const slots = getRegistroSlots(registro);
                        const parcelaNombre = getParcelaNombre(slots.parcelaId);
                        const depositoNombre = getDepositoNombre(registro.depositoId);
                        const localLabel = depositoNombre || registro.local?.trim() || parcelaNombre;
                        const tipoTrabajo = slots.tipoTrabajo || "N/A";

                        return (
                          <TableRow key={registro.id} className="odd:bg-muted/10 hover:bg-accent/20">
                            <TableCell className="font-medium">{localLabel}</TableCell>
                            <TableCell>{getEmpleadoNombre(registro.empleadoId)}</TableCell>
                            <TableCell>{formatFecha(registro.fecha)}</TableCell>
                            <TableCell>{parcelaNombre}</TableCell>
                            <TableCell>{tipoTrabajo}</TableCell>
                            <TableCell className="font-mono">{slots.amEntrada || "-"}</TableCell>
                            <TableCell className="font-mono">{slots.amSalida || "-"}</TableCell>
                            <TableCell className="font-mono">{slots.pmEntrada || "-"}</TableCell>
                            <TableCell className="font-mono">{slots.pmSalida || "-"}</TableCell>
                            <TableCell>{formatHours(totalMinutes)}</TableCell>
                            <TableCell>{formatMoney(precioHora)}</TableCell>
                            <TableCell className="font-semibold">{formatMoney(totalJornada)}</TableCell>
                            {user && (
                              <TableCell className="text-right no-print">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Abrir menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => openForm(registro)}>Editar</DropdownMenuItem>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem
                                          onSelect={(event) => event.preventDefault()}
                                          className="text-destructive"
                                        >
                                          Eliminar
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Desea eliminar este registro de control horario?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta accion no se puede deshacer.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDelete(registro.id)}
                                            className="bg-destructive hover:bg-destructive/90"
                                          >
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      });

                      return [groupHeader, ...rows];
                    })}
                </TableBody>
                {!isLoading && groupedRegistros.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/45">
                      <td className="p-4 text-right font-semibold" colSpan={9}>
                        Total general ({periodTotals.totalRegistros} registros)
                      </td>
                      <td className="p-4 text-right font-semibold">{formatHours(periodTotals.totalMinutes)}</td>
                      <td className="p-4 text-right font-semibold">Total</td>
                      <td className="p-4 text-right font-semibold">{formatMoney(periodTotals.totalPagar)}</td>
                      {user && <td className="p-4 no-print" />}
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {showDashboard && (
        <ControlHorarioDashboard
          registros={filteredRegistros}
          empleados={empleados}
          parcelas={parcelas}
          depositos={depositos}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          isLoading={isLoading}
          invalidDateRange={invalidDateRange}
        />
      )}

      <Dialog modal={false} open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent draggable className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>
              {selectedRegistro ? "Editar Registro de Horario" : "Crear Nuevo Registro de Horario"}
            </DialogTitle>
            <DialogDescription>
              Complete LOCAL, empleado, fecha, parcela, tipo de trabajo, precio por hora (Gs) y horarios AM/PM.
            </DialogDescription>
          </DialogHeader>
          <ControlHorarioForm
            registro={selectedRegistro}
            empleados={empleados}
            parcelas={parcelas}
            depositos={depositos}
            tiposTrabajo={tiposTrabajo}
            onCreateTipoTrabajo={handleCreateTipoTrabajo}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedRegistro(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <BiometricImportModal
        isOpen={isImportOpen}
        parcelas={parcelas}
        depositos={depositos}
        selectedMonth={matrixDefaultMonth}
        selectedYear={matrixDefaultYear}
        years={years}
        onClose={() => setImportOpen(false)}
        onImport={handleBiometricImport}
      />
    </>
  );
}

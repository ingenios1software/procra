"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { doc, orderBy, writeBatch } from "firebase/firestore";
import { ReciboCobro as ReciboCobroCard, type ReciboCobroViewModel } from "@/components/finanzas/recibo-cobro";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import {
  calcularEstadoCuenta,
  calcularSaldoDesdeMovimiento,
  generarNumeroReciboCobro,
  toDateSafe,
} from "@/lib/cuentas";
import { withZafraContext } from "@/lib/contabilidad/asientos";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import type {
  AsientoDiario,
  Cliente,
  CobroCuentaPorCobrar,
  CuentaCajaBanco,
  CuentaPorCobrar,
  CuentaPorPagar,
  Moneda,
  NotaCreditoFinanciera,
  PagoCuentaPorPagar,
  PlanDeCuenta,
  Proveedor,
  ReciboCobro,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type OperationMode = "cobro" | "pago" | "notaCreditoCobro" | "notaCreditoPago";
type WorkspaceTab = "cabecera" | "aplicaciones" | "resumen";

type FinancialAccountOption = {
  id: string;
  tipo: CuentaCajaBanco["tipo"];
  label: string;
  cuentaContableId: string;
  moneda: "USD" | "PYG" | null;
};

type PendingDocumentRow = {
  id: string;
  documento: string;
  thirdPartyId: string;
  terceroNombre: string;
  moneda: "USD" | "PYG";
  saldoPendiente: number;
  montoOriginal: number;
  fechaEmision?: Date | string;
  fechaVencimiento?: Date | string;
  estado: CuentaPorCobrar["estado"] | CuentaPorPagar["estado"];
  zafraId?: string;
  zafraNombre?: string | null;
};

type SelectedDocumentRow = PendingDocumentRow & {
  montoAplicado: number;
  saldoRestante: number;
};

interface FinancialOperationWindowProps {
  planDeCuentas?: PlanDeCuenta[] | null;
  cuentasCajaBanco?: CuentaCajaBanco[] | null;
  monedas?: Moneda[] | null;
}

type CreditNoteReason = NotaCreditoFinanciera["motivo"];

const MONEY_TOLERANCE = 0.005;

function summarizeByCurrency(rows: Array<{ moneda: "USD" | "PYG"; saldoPendiente: number }>) {
  return rows.reduce(
    (summary, row) => {
      summary[row.moneda] += Number(row.saldoPendiente || 0);
      return summary;
    },
    { USD: 0, PYG: 0 }
  );
}

function parseDateInputToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMonedaCodigo(monedaId: string | undefined, monedasById: Map<string, Moneda>): "USD" | "PYG" | null {
  if (!monedaId) return null;
  const moneda = monedasById.get(monedaId);
  const base = `${moneda?.codigo || ""} ${moneda?.descripcion || ""} ${monedaId}`.toUpperCase();
  if (base.includes("USD")) return "USD";
  if (base.includes("PYG") || base.includes("GS") || base.includes("GUARANI")) return "PYG";
  return null;
}

function getEstadoClassName(estado: CuentaPorCobrar["estado"] | CuentaPorPagar["estado"]): string {
  if (estado === "cancelada") return "bg-green-600 text-white";
  if (estado === "vencida") return "bg-red-600 text-white";
  if (estado === "parcial") return "bg-blue-600 text-white";
  if (estado === "anulada") return "bg-gray-600 text-white";
  return "bg-yellow-500 text-black";
}

function formatDateLabel(value?: Date | string) {
  const parsed = toDateSafe(value);
  return parsed ? format(parsed, "dd/MM/yyyy") : "-";
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function aggregateMovements(
  entries: Array<{ cuentaId: string; tipo: "debe" | "haber"; monto: number }>
): AsientoDiario["movimientos"] {
  const grouped = new Map<string, number>();

  for (const entry of entries) {
    const key = `${entry.tipo}:${entry.cuentaId}`;
    grouped.set(key, roundMoney((grouped.get(key) || 0) + Number(entry.monto || 0)));
  }

  return Array.from(grouped.entries())
    .filter(([, monto]) => monto > MONEY_TOLERANCE)
    .map(([key, monto]) => {
      const [tipo, cuentaId] = key.split(":");
      return {
        cuentaId,
        tipo: tipo as "debe" | "haber",
        monto,
      };
    });
}

function getSharedZafra(rows: Array<{ zafraId?: string; zafraNombre?: string | null }>) {
  if (rows.length === 0) return { zafraId: undefined, zafraNombre: null as string | null };
  const first = rows[0];
  const same = rows.every(
    (row) => (row.zafraId || "") === (first.zafraId || "") && (row.zafraNombre || "") === (first.zafraNombre || "")
  );
  if (!same) return { zafraId: undefined, zafraNombre: null };
  return {
    zafraId: first.zafraId,
    zafraNombre: first.zafraNombre || null,
  };
}

export function FinancialOperationWindow({
  planDeCuentas,
  cuentasCajaBanco,
  monedas,
}: FinancialOperationWindowProps) {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const { toast } = useToast();

  const [mode, setMode] = useState<OperationMode>("cobro");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("cabecera");
  const [search, setSearch] = useState("");
  const [fechaOperacion, setFechaOperacion] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState("");
  const [cuentaAjusteId, setCuentaAjusteId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [motivoNota, setMotivoNota] = useState<CreditNoteReason>("descuento_pronto_pago");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [appliedAmounts, setAppliedAmounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<ReciboCobroViewModel | null>(null);
  const [isReciboOpen, setIsReciboOpen] = useState(false);

  const isCreditNoteMode = mode === "notaCreditoCobro" || mode === "notaCreditoPago";
  const documentMode: "cobro" | "pago" =
    mode === "cobro" || mode === "notaCreditoCobro" ? "cobro" : "pago";

  const deferredSearch = useDeferredValue(search);

  const {
    data: cuentasPorCobrar,
    isLoading: isLoadingCxc,
    forceRefetch: refetchCxc,
  } = useCollection<CuentaPorCobrar>(
    useMemoFirebase(
      () => tenant.query("cuentasPorCobrar", orderBy("fechaEmision", "desc")),
      [tenant]
    )
  );
  const {
    data: cuentasPorPagar,
    isLoading: isLoadingCxp,
    forceRefetch: refetchCxp,
  } = useCollection<CuentaPorPagar>(
    useMemoFirebase(
      () => tenant.query("cuentasPorPagar", orderBy("fechaEmision", "desc")),
      [tenant]
    )
  );
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(
    useMemoFirebase(() => tenant.collection("clientes"), [tenant])
  );
  const { data: proveedores, isLoading: isLoadingProveedores } = useCollection<Proveedor>(
    useMemoFirebase(() => tenant.collection("proveedores"), [tenant])
  );

  const clientesById = useMemo(() => new Map((clientes || []).map((item) => [item.id, item.nombre])), [clientes]);
  const proveedoresById = useMemo(
    () => new Map((proveedores || []).map((item) => [item.id, item.nombre])),
    [proveedores]
  );
  const planById = useMemo(
    () => new Map((planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta])),
    [planDeCuentas]
  );
  const monedasById = useMemo(() => new Map((monedas || []).map((item) => [item.id, item])), [monedas]);
  const cuentaClientesBaseId = useMemo(
    () => findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.CLIENTES)?.id || "",
    [planDeCuentas]
  );
  const cuentaProveedoresBaseId = useMemo(
    () => findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id || "",
    [planDeCuentas]
  );

  const cuentasFinancieras = useMemo<FinancialAccountOption[]>(() => {
    const options: FinancialAccountOption[] = [];

    for (const cuentaCajaBanco of cuentasCajaBanco || []) {
      if (!cuentaCajaBanco.activo || !cuentaCajaBanco.cuentaContableId) continue;
      const cuentaContable = planById.get(cuentaCajaBanco.cuentaContableId);
      if (!cuentaContable) continue;

      let monedaCodigo = getMonedaCodigo(cuentaCajaBanco.monedaId, monedasById);
      if (!monedaCodigo) {
        const hint = normalizeText(cuentaCajaBanco.nombre);
        if (hint.includes("usd") || hint.includes("u$") || hint.includes("dolar")) monedaCodigo = "USD";
        if (hint.includes("gs") || hint.includes("guarani")) monedaCodigo = "PYG";
      }

      options.push({
        id: cuentaCajaBanco.id,
        tipo: cuentaCajaBanco.tipo,
        moneda: monedaCodigo,
        cuentaContableId: cuentaContable.id,
        label: `${cuentaCajaBanco.tipo} ${cuentaCajaBanco.nombre} - ${cuentaContable.codigo} - ${cuentaContable.nombre}`,
      });
    }

    return options;
  }, [cuentasCajaBanco, planById, monedasById]);

  const cuentasAjuste = useMemo(() => {
    return (planDeCuentas || [])
      .filter((cuenta) => ["ingreso", "gasto", "costo", "pasivo"].includes(cuenta.tipo))
      .map((cuenta) => ({
        id: cuenta.id,
        label: `${cuenta.codigo} - ${cuenta.nombre}`,
      }));
  }, [planDeCuentas]);

  const cuentasFinancierasById = useMemo(
    () => new Map(cuentasFinancieras.map((cuenta) => [cuenta.id, cuenta])),
    [cuentasFinancieras]
  );
  const cuentasCobroById = useMemo(
    () => new Map((cuentasPorCobrar || []).map((cuenta) => [cuenta.id, cuenta])),
    [cuentasPorCobrar]
  );
  const cuentasPagoById = useMemo(
    () => new Map((cuentasPorPagar || []).map((cuenta) => [cuenta.id, cuenta])),
    [cuentasPorPagar]
  );

  const pendingCobros = useMemo<PendingDocumentRow[]>(() => {
    return (cuentasPorCobrar || [])
      .filter((cuenta) => Number(cuenta.saldoPendiente || 0) > MONEY_TOLERANCE && cuenta.estado !== "anulada")
      .map((cuenta) => ({
        id: cuenta.id,
        documento: cuenta.ventaDocumento || cuenta.ventaId,
        thirdPartyId: cuenta.clienteId,
        terceroNombre: clientesById.get(cuenta.clienteId) || cuenta.clienteId,
        moneda: cuenta.moneda,
        saldoPendiente: Number(cuenta.saldoPendiente || 0),
        montoOriginal: Number(cuenta.montoOriginal || 0),
        fechaEmision: cuenta.fechaEmision,
        fechaVencimiento: cuenta.fechaVencimiento,
        estado: cuenta.estado,
        zafraId: cuenta.zafraId,
        zafraNombre: cuenta.zafraNombre || null,
      }));
  }, [cuentasPorCobrar, clientesById]);

  const pendingPagos = useMemo<PendingDocumentRow[]>(() => {
    return (cuentasPorPagar || [])
      .filter((cuenta) => Number(cuenta.saldoPendiente || 0) > MONEY_TOLERANCE && cuenta.estado !== "anulada")
      .map((cuenta) => ({
        id: cuenta.id,
        documento: cuenta.compraDocumento || cuenta.compraId,
        thirdPartyId: cuenta.proveedorId,
        terceroNombre: proveedoresById.get(cuenta.proveedorId) || cuenta.proveedorId,
        moneda: cuenta.moneda,
        saldoPendiente: Number(cuenta.saldoPendiente || 0),
        montoOriginal: Number(cuenta.montoOriginal || 0),
        fechaEmision: cuenta.fechaEmision,
        fechaVencimiento: cuenta.fechaVencimiento,
        estado: cuenta.estado,
        zafraId: cuenta.zafraId,
        zafraNombre: cuenta.zafraNombre || null,
      }));
  }, [cuentasPorPagar, proveedoresById]);

  const totalPorCobrar = useMemo(() => summarizeByCurrency(pendingCobros), [pendingCobros]);
  const totalPorPagar = useMemo(() => summarizeByCurrency(pendingPagos), [pendingPagos]);

  const activeRows = documentMode === "cobro" ? pendingCobros : pendingPagos;
  const activeRowsById = useMemo(() => new Map(activeRows.map((row) => [row.id, row])), [activeRows]);
  const normalizedSearch = normalizeText(deferredSearch);

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return activeRows;
    return activeRows.filter((row) =>
      normalizeText(`${row.documento} ${row.terceroNombre} ${row.zafraNombre || ""} ${row.id}`).includes(normalizedSearch)
    );
  }, [activeRows, normalizedSearch]);

  useEffect(() => {
    setSelectedIds([]);
    setAppliedAmounts({});
    setReferencia("");
    setWorkspaceTab("cabecera");
  }, [mode]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => activeRowsById.has(id)));
    setAppliedAmounts((current) => {
      const next = { ...current };
      Object.keys(next).forEach((id) => {
        if (!activeRowsById.has(id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [activeRowsById]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => activeRowsById.get(id)).filter(Boolean) as PendingDocumentRow[],
    [selectedIds, activeRowsById]
  );
  const selectionBase = selectedRows[0] || null;
  const selectedCurrency = selectionBase?.moneda || null;
  const selectedThirdPartyLabel = selectionBase?.terceroNombre || "";
  const cuentasFinancierasCompatibles = useMemo(() => {
    if (!selectedCurrency) return cuentasFinancieras;
    return cuentasFinancieras.filter((cuenta) => !cuenta.moneda || cuenta.moneda === selectedCurrency);
  }, [cuentasFinancieras, selectedCurrency]);
  const selectedCuentaFinanciera = cuentaFinancieraId ? cuentasFinancierasById.get(cuentaFinancieraId) || null : null;
  const selectedCuentaAjuste = cuentaAjusteId ? planById.get(cuentaAjusteId) || null : null;

  const selectedDocuments = useMemo<SelectedDocumentRow[]>(() => {
    return selectedRows.map((row) => {
      const montoAplicado = roundMoney(Number(appliedAmounts[row.id] || 0));
      return {
        ...row,
        montoAplicado,
        saldoRestante: roundMoney(row.saldoPendiente - montoAplicado),
      };
    });
  }, [selectedRows, appliedAmounts]);

  const selectedTotal = useMemo(
    () => roundMoney(selectedDocuments.reduce((sum, row) => sum + row.montoAplicado, 0)),
    [selectedDocuments]
  );
  const selectedPendingTotal = useMemo(
    () => roundMoney(selectedDocuments.reduce((sum, row) => sum + row.saldoPendiente, 0)),
    [selectedDocuments]
  );
  const selectedRemainingTotal = useMemo(
    () => roundMoney(selectedDocuments.reduce((sum, row) => sum + row.saldoRestante, 0)),
    [selectedDocuments]
  );
  const hasInvalidAmounts = selectedDocuments.some(
    (row) =>
      !Number.isFinite(row.montoAplicado) ||
      row.montoAplicado <= 0 ||
      row.montoAplicado > row.saldoPendiente + MONEY_TOLERANCE
  );
  const currencyMismatch = Boolean(
    !isCreditNoteMode &&
      selectedCurrency &&
      selectedCuentaFinanciera?.moneda &&
      selectedCuentaFinanciera.moneda !== selectedCurrency
  );

  useEffect(() => {
    if (!selectedCurrency) return;
    if (isCreditNoteMode) {
      setCuentaAjusteId((current) => {
        const currentCuenta = current ? planById.get(current) || null : null;
        if (currentCuenta) return current;
        const sugerida =
          (planDeCuentas || []).find((cuenta) =>
            normalizeText(`${cuenta.codigo} ${cuenta.nombre}`).includes("descuento")
          )?.id || cuentasAjuste[0]?.id || "";
        return sugerida;
      });
      return;
    }

    setCuentaFinancieraId((current) => {
      const currentCuenta = current ? cuentasFinancierasById.get(current) || null : null;
      if (currentCuenta && (!currentCuenta.moneda || currentCuenta.moneda === selectedCurrency)) {
        return current;
      }
      return cuentasFinancierasCompatibles[0]?.id || "";
    });
  }, [
    selectedCurrency,
    isCreditNoteMode,
    planById,
    planDeCuentas,
    cuentasAjuste,
    cuentasFinancierasCompatibles,
    cuentasFinancierasById,
  ]);

  const reciboTargetId = "tesoreria-recibo-cobro-target";
  const reciboSummary = ultimoRecibo
    ? `${ultimoRecibo.clienteNombre} | ${ultimoRecibo.documento} | ${ultimoRecibo.moneda} ${formatCurrency(ultimoRecibo.monto)}`
    : "";

  const asientoPreview = useMemo(() => {
    if (selectedDocuments.length === 0 || selectedTotal <= MONEY_TOLERANCE) return [];

    const entries: Array<{ cuentaId: string; tipo: "debe" | "haber"; monto: number }> = [];

    if (isCreditNoteMode) {
      if (selectedCuentaAjuste) {
        entries.push({
          cuentaId: selectedCuentaAjuste.id,
          tipo: documentMode === "pago" ? "haber" : "debe",
          monto: selectedTotal,
        });
      }
    } else if (selectedCuentaFinanciera) {
      entries.push({
        cuentaId: selectedCuentaFinanciera.cuentaContableId,
        tipo: documentMode === "cobro" ? "debe" : "haber",
        monto: selectedTotal,
      });
    }

    for (const item of selectedDocuments) {
      if (documentMode === "cobro") {
        const cuenta = cuentasCobroById.get(item.id);
        const cuentaId = cuenta?.cuentaContableId || cuentaClientesBaseId;
        if (!cuentaId) continue;
        entries.push({ cuentaId, tipo: "haber", monto: item.montoAplicado });
        continue;
      }

      const cuenta = cuentasPagoById.get(item.id);
      const cuentaId = cuenta?.cuentaContableId || cuentaProveedoresBaseId;
      if (!cuentaId) continue;
      entries.push({ cuentaId, tipo: "debe", monto: item.montoAplicado });
    }

    return aggregateMovements(entries).map((movement) => ({
      ...movement,
      label: (() => {
        const cuenta = planById.get(movement.cuentaId);
        return cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : movement.cuentaId;
      })(),
      debe: movement.tipo === "debe" ? movement.monto : 0,
      haber: movement.tipo === "haber" ? movement.monto : 0,
    }));
  }, [
    cuentasCobroById,
    cuentasPagoById,
    cuentaClientesBaseId,
    cuentaProveedoresBaseId,
    documentMode,
    isCreditNoteMode,
    planById,
    selectedCuentaAjuste,
    selectedCuentaFinanciera,
    selectedDocuments,
    selectedTotal,
  ]);

  const isRowCompatible = (row: PendingDocumentRow) => {
    if (!selectionBase) return true;
    if (selectedIds.includes(row.id)) return true;
    return row.moneda === selectionBase.moneda && row.thirdPartyId === selectionBase.thirdPartyId;
  };

  const handleToggleRow = (row: PendingDocumentRow, checked: boolean) => {
    if (checked && !isRowCompatible(row)) {
      toast({
        variant: "destructive",
        title: "Liquidacion incompatible",
        description: "Solo puede mezclar documentos del mismo cliente/proveedor y de la misma moneda.",
      });
      return;
    }

    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(row.id)) return current;
        return [...current, row.id];
      }
      return current.filter((id) => id !== row.id);
    });

    setAppliedAmounts((current) => {
      if (checked) {
        return {
          ...current,
          [row.id]: current[row.id] ?? String(row.saldoPendiente),
        };
      }
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  };

  const handleSelectVisible = () => {
    if (filteredRows.length === 0) return;
    const base = selectionBase || filteredRows[0];
    const compatibles = filteredRows.filter(
      (row) => row.moneda === base.moneda && row.thirdPartyId === base.thirdPartyId
    );

    setSelectedIds((current) => {
      const next = new Set(current);
      compatibles.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
    setAppliedAmounts((current) => {
      const next = { ...current };
      compatibles.forEach((row) => {
        if (next[row.id] == null) next[row.id] = String(row.saldoPendiente);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setAppliedAmounts({});
  };

  const handleFillBalances = () => {
    setAppliedAmounts((current) => {
      const next = { ...current };
      selectedRows.forEach((row) => {
        next[row.id] = String(row.saldoPendiente);
      });
      return next;
    });
  };

  const handleRegister = async () => {
    const financialAccount = selectedCuentaFinanciera;
    const adjustmentAccount = selectedCuentaAjuste;

    if (!firestore || !user || selectedDocuments.length === 0) return;
    if (!isCreditNoteMode && !financialAccount) return;
    if (isCreditNoteMode && !adjustmentAccount) return;

    if (hasInvalidAmounts) {
      toast({
        variant: "destructive",
        title: "Montos invalidos",
        description: "Revise los importes aplicados. Deben ser mayores a cero y no superar el saldo.",
      });
      return;
    }
    if (currencyMismatch) {
      toast({
        variant: "destructive",
        title: "Moneda incompatible",
        description: "La cuenta financiera seleccionada no coincide con la moneda de la liquidacion.",
      });
      return;
    }

    const fechaIso = parseDateInputToIso(fechaOperacion);
    if (!fechaIso) {
      toast({ variant: "destructive", title: "Fecha invalida", description: "Verifique la fecha ingresada." });
      return;
    }

    const referenciaTrimmed = referencia.trim();
    const sharedZafra = getSharedZafra(selectedDocuments);
    setIsSaving(true);

    try {
      if (isCreditNoteMode) {
        const notasCol = tenant.collection("notasCreditoFinancieras");
        const asientosCol = tenant.collection("asientosDiario");
        if (!notasCol || !asientosCol || !adjustmentAccount) return;

        const notaRef = doc(notasCol);
        const asientoRef = doc(asientosCol);
        const batch = writeBatch(firestore);
        const aplicaciones: NotaCreditoFinanciera["aplicaciones"] = [];
        const asientoMovimientos: Array<{ cuentaId: string; tipo: "debe" | "haber"; monto: number }> = [
          {
            cuentaId: adjustmentAccount.id,
            tipo: documentMode === "pago" ? "haber" : "debe",
            monto: selectedTotal,
          },
        ];

        for (const item of selectedDocuments) {
          if (documentMode === "cobro") {
            const cuenta = cuentasCobroById.get(item.id);
            if (!cuenta) continue;

            const cuentaClientesId =
              cuenta.cuentaContableId ||
              findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.CLIENTES)?.id;
            if (!cuentaClientesId) {
              toast({
                variant: "destructive",
                title: "Cuenta clientes faltante",
                description: "No se encontro la cuenta contable base de clientes.",
              });
              return;
            }

            const cuentaRef = tenant.doc("cuentasPorCobrar", cuenta.id);
            if (!cuentaRef) return;

            const saldoResult = calcularSaldoDesdeMovimiento({
              montoOriginal: Number(cuenta.montoOriginal) || 0,
              montoAplicadoActual: Number(cuenta.montoCobrado) || 0,
              montoMovimiento: item.montoAplicado,
            });
            const estado = calcularEstadoCuenta({
              montoOriginal: Number(cuenta.montoOriginal) || 0,
              saldoPendiente: saldoResult.saldoPendiente,
              fechaVencimiento: cuenta.fechaVencimiento,
            });

            asientoMovimientos.push({ cuentaId: cuentaClientesId, tipo: "haber", monto: item.montoAplicado });
            aplicaciones.push({
              cuentaId: cuenta.id,
              documento: cuenta.ventaDocumento || cuenta.ventaId,
              montoAplicado: item.montoAplicado,
              ventaId: cuenta.ventaId,
            });

            batch.update(cuentaRef, {
              montoCobrado: saldoResult.montoAplicado,
              saldoPendiente: saldoResult.saldoPendiente,
              estado,
              actualizadoEn: fechaIso,
            });
            continue;
          }

          const cuenta = cuentasPagoById.get(item.id);
          if (!cuenta) continue;

          const cuentaPasivoId =
            cuenta.cuentaContableId ||
            findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id;
          if (!cuentaPasivoId) {
            toast({
              variant: "destructive",
              title: "Cuenta proveedores faltante",
              description: "No se encontro la cuenta contable base de proveedores.",
            });
            return;
          }

          const cuentaRef = tenant.doc("cuentasPorPagar", cuenta.id);
          const compraRef = tenant.doc("comprasNormal", cuenta.compraId);
          if (!cuentaRef || !compraRef) return;

          const saldoResult = calcularSaldoDesdeMovimiento({
            montoOriginal: Number(cuenta.montoOriginal) || 0,
            montoAplicadoActual: Number(cuenta.montoPagado) || 0,
            montoMovimiento: item.montoAplicado,
          });
          const estado = calcularEstadoCuenta({
            montoOriginal: Number(cuenta.montoOriginal) || 0,
            saldoPendiente: saldoResult.saldoPendiente,
            fechaVencimiento: cuenta.fechaVencimiento,
          });

          asientoMovimientos.push({ cuentaId: cuentaPasivoId, tipo: "debe", monto: item.montoAplicado });
          aplicaciones.push({
            cuentaId: cuenta.id,
            documento: cuenta.compraDocumento || cuenta.compraId,
            montoAplicado: item.montoAplicado,
            compraId: cuenta.compraId,
          });

          batch.update(cuentaRef, {
            montoPagado: saldoResult.montoAplicado,
            saldoPendiente: saldoResult.saldoPendiente,
            estado,
            actualizadoEn: fechaIso,
          });
          batch.update(compraRef, {
            "financiero.pagoAplicado": saldoResult.saldoPendiente <= MONEY_TOLERANCE,
          });
        }

        const asientoData: Omit<AsientoDiario, "id"> = withZafraContext(
          {
            fecha: fechaIso,
            descripcion:
              documentMode === "cobro"
                ? `Nota de credito clientes ${selectedDocuments.length} doc(s) - ${selectedThirdPartyLabel}`
                : `Nota de credito proveedores ${selectedDocuments.length} doc(s) - ${selectedThirdPartyLabel}`,
            movimientos: aggregateMovements(asientoMovimientos),
          },
          sharedZafra
        );
        batch.set(asientoRef, asientoData);

        const notaData: Omit<NotaCreditoFinanciera, "id"> = {
          tipoAplicacion: documentMode,
          motivo: motivoNota,
          thirdPartyId: selectionBase?.thirdPartyId || "",
          thirdPartyNombre: selectedThirdPartyLabel || undefined,
          fecha: fechaIso,
          moneda: selectedCurrency || "PYG",
          montoTotal: selectedTotal,
          cuentaContrapartidaId: adjustmentAccount.id,
          asientoId: asientoRef.id,
          zafraId: sharedZafra.zafraId,
          zafraNombre: sharedZafra.zafraNombre,
          aplicaciones,
          creadoPor: user.uid,
          creadoEn: fechaIso,
          ...(referenciaTrimmed ? { referencia: referenciaTrimmed } : {}),
        };
        batch.set(notaRef, notaData);

        await batch.commit();

        handleClearSelection();
        setReferencia("");
        toast({
          title: "Nota de credito aplicada",
          description: `Se ajustaron ${selectedDocuments.length} documento(s) por ${selectedCurrency} ${formatCurrency(selectedTotal)}.`,
        });
        if (documentMode === "cobro") {
          refetchCxc();
        } else {
          refetchCxp();
        }
        return;
      }

      if (!financialAccount) return;

      if (mode === "cobro") {
        const cobrosCol = tenant.collection("cobrosCxc");
        const recibosCol = tenant.collection("recibosCobro");
        const asientosCol = tenant.collection("asientosDiario");
        if (!cobrosCol || !recibosCol || !asientosCol) return;

        const asientoRef = doc(asientosCol);
        const batch = writeBatch(firestore);
        const fechaAsDate = toDateSafe(fechaIso) || new Date();
        const asientoMovimientos: Array<{ cuentaId: string; tipo: "debe" | "haber"; monto: number }> = [
          { cuentaId: financialAccount.cuentaContableId, tipo: "debe", monto: selectedTotal },
        ];

        let reciboPreview: ReciboCobroViewModel | null = null;

        for (const item of selectedDocuments) {
          const cuenta = cuentasCobroById.get(item.id);
          if (!cuenta) continue;

          const cuentaClientesId =
            cuenta.cuentaContableId ||
            findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.CLIENTES)?.id;
          if (!cuentaClientesId) {
            toast({
              variant: "destructive",
              title: "Cuenta clientes faltante",
              description: "No se encontro la cuenta contable base de clientes.",
            });
            return;
          }

          const cuentaRef = tenant.doc("cuentasPorCobrar", cuenta.id);
          if (!cuentaRef) return;

          const cobroRef = doc(cobrosCol);
          const reciboRef = doc(recibosCol);
          const numeroRecibo = generarNumeroReciboCobro(fechaAsDate, cobroRef.id.slice(-4));
          const saldoResult = calcularSaldoDesdeMovimiento({
            montoOriginal: Number(cuenta.montoOriginal) || 0,
            montoAplicadoActual: Number(cuenta.montoCobrado) || 0,
            montoMovimiento: item.montoAplicado,
          });
          const estado = calcularEstadoCuenta({
            montoOriginal: Number(cuenta.montoOriginal) || 0,
            saldoPendiente: saldoResult.saldoPendiente,
            fechaVencimiento: cuenta.fechaVencimiento,
          });

          asientoMovimientos.push({ cuentaId: cuentaClientesId, tipo: "haber", monto: item.montoAplicado });

          const cobroData: Omit<CobroCuentaPorCobrar, "id"> = {
            cuentaPorCobrarId: cuenta.id,
            ventaId: cuenta.ventaId,
            clienteId: cuenta.clienteId,
            zafraId: cuenta.zafraId,
            zafraNombre: cuenta.zafraNombre || null,
            fecha: fechaIso,
            moneda: cuenta.moneda,
            monto: item.montoAplicado,
            cuentaContableId: financialAccount.cuentaContableId,
            cuentaCajaBancoId: financialAccount.id,
            asientoId: asientoRef.id,
            reciboId: reciboRef.id,
            recibidoPor: user.uid,
            creadoEn: fechaIso,
            ...(referenciaTrimmed ? { referencia: referenciaTrimmed } : {}),
          };
          batch.set(cobroRef, cobroData);

          const reciboData: Omit<ReciboCobro, "id"> = {
            numero: numeroRecibo,
            cobroId: cobroRef.id,
            cuentaPorCobrarId: cuenta.id,
            ventaId: cuenta.ventaId,
            clienteId: cuenta.clienteId,
            fecha: fechaIso,
            moneda: cuenta.moneda,
            monto: item.montoAplicado,
            estado: "emitido",
            emitidoPor: user.uid,
            creadoEn: fechaIso,
            ...(referenciaTrimmed ? { observacion: referenciaTrimmed } : {}),
          };
          batch.set(reciboRef, reciboData);

          batch.update(cuentaRef, {
            montoCobrado: saldoResult.montoAplicado,
            saldoPendiente: saldoResult.saldoPendiente,
            estado,
            actualizadoEn: fechaIso,
          });

          if (selectedDocuments.length === 1) {
            reciboPreview = {
              numero: numeroRecibo,
              fecha: fechaIso,
              clienteNombre: clientesById.get(cuenta.clienteId) || cuenta.clienteId,
              documento: cuenta.ventaDocumento || cuenta.ventaId,
              monto: item.montoAplicado,
              moneda: cuenta.moneda,
              cuentaIngreso: financialAccount.label,
              estado: "emitido",
              ...(referenciaTrimmed ? { referencia: referenciaTrimmed } : {}),
            };
          }
        }

        const asientoData: Omit<AsientoDiario, "id"> = withZafraContext(
          {
            fecha: fechaIso,
            descripcion:
              selectedDocuments.length === 1
                ? `Cobro ${selectedDocuments[0].documento}`
                : `Liquidacion de cobro ${selectedDocuments.length} documentos - ${selectedThirdPartyLabel}`,
            movimientos: aggregateMovements(asientoMovimientos),
          },
          sharedZafra
        );
        batch.set(asientoRef, asientoData);

        await batch.commit();

        if (reciboPreview) {
          setUltimoRecibo(reciboPreview);
          setIsReciboOpen(true);
        }

        handleClearSelection();
        setReferencia("");
        toast({
          title: selectedDocuments.length === 1 ? "Cobro registrado" : "Liquidacion de cobro registrada",
          description:
            selectedDocuments.length === 1
              ? `Se registro un cobro por ${selectedCurrency} ${formatCurrency(selectedTotal)}.`
              : `Se aplicaron ${selectedDocuments.length} documentos por ${selectedCurrency} ${formatCurrency(selectedTotal)}.`,
        });
        refetchCxc();
        return;
      }

      const pagosCol = tenant.collection("pagosCxp");
      const asientosCol = tenant.collection("asientosDiario");
      if (!pagosCol || !asientosCol) return;

      const asientoRef = doc(asientosCol);
      const batch = writeBatch(firestore);
      const asientoMovimientos: Array<{ cuentaId: string; tipo: "debe" | "haber"; monto: number }> = [
        { cuentaId: financialAccount.cuentaContableId, tipo: "haber", monto: selectedTotal },
      ];

      for (const item of selectedDocuments) {
        const cuenta = cuentasPagoById.get(item.id);
        if (!cuenta) continue;

        const cuentaPasivoId =
          cuenta.cuentaContableId ||
          findPlanCuentaByCodigo(planDeCuentas || [], CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id;
        if (!cuentaPasivoId) {
          toast({
            variant: "destructive",
            title: "Cuenta proveedores faltante",
            description: "No se encontro la cuenta contable base de proveedores.",
          });
          return;
        }

        const cuentaRef = tenant.doc("cuentasPorPagar", cuenta.id);
        const compraRef = tenant.doc("comprasNormal", cuenta.compraId);
        if (!cuentaRef || !compraRef) return;

        const pagoRef = doc(pagosCol);
        const saldoResult = calcularSaldoDesdeMovimiento({
          montoOriginal: Number(cuenta.montoOriginal) || 0,
          montoAplicadoActual: Number(cuenta.montoPagado) || 0,
          montoMovimiento: item.montoAplicado,
        });
        const estado = calcularEstadoCuenta({
          montoOriginal: Number(cuenta.montoOriginal) || 0,
          saldoPendiente: saldoResult.saldoPendiente,
          fechaVencimiento: cuenta.fechaVencimiento,
        });

        asientoMovimientos.push({ cuentaId: cuentaPasivoId, tipo: "debe", monto: item.montoAplicado });

        const pagoData: Omit<PagoCuentaPorPagar, "id"> = {
          cuentaPorPagarId: cuenta.id,
          compraId: cuenta.compraId,
          proveedorId: cuenta.proveedorId,
          zafraId: cuenta.zafraId,
          zafraNombre: cuenta.zafraNombre || null,
          fecha: fechaIso,
          moneda: cuenta.moneda,
          monto: item.montoAplicado,
          cuentaContableId: financialAccount.cuentaContableId,
          cuentaCajaBancoId: financialAccount.id,
          asientoId: asientoRef.id,
          pagadoPor: user.uid,
          creadoEn: fechaIso,
          ...(referenciaTrimmed ? { referencia: referenciaTrimmed } : {}),
        };
        batch.set(pagoRef, pagoData);

        batch.update(cuentaRef, {
          montoPagado: saldoResult.montoAplicado,
          saldoPendiente: saldoResult.saldoPendiente,
          estado,
          actualizadoEn: fechaIso,
        });

        batch.update(compraRef, {
          "financiero.pagoAplicado": saldoResult.saldoPendiente <= MONEY_TOLERANCE,
          "financiero.cuentaPagoId": financialAccount.cuentaContableId,
          "financiero.asientoPagoId": asientoRef.id,
          "financiero.fechaPago": fechaIso,
        });
      }

      const asientoData: Omit<AsientoDiario, "id"> = withZafraContext(
        {
          fecha: fechaIso,
          descripcion:
            selectedDocuments.length === 1
              ? `Pago ${selectedDocuments[0].documento}`
              : `Liquidacion de pago ${selectedDocuments.length} documentos - ${selectedThirdPartyLabel}`,
          movimientos: aggregateMovements(asientoMovimientos),
        },
        sharedZafra
      );
      batch.set(asientoRef, asientoData);

      await batch.commit();

      handleClearSelection();
      setReferencia("");
      toast({
        title: selectedDocuments.length === 1 ? "Pago registrado" : "Liquidacion de pago registrada",
        description:
          selectedDocuments.length === 1
            ? `Se registro un pago por ${selectedCurrency} ${formatCurrency(selectedTotal)}.`
            : `Se aplicaron ${selectedDocuments.length} documentos por ${selectedCurrency} ${formatCurrency(selectedTotal)}.`,
      });
      refetchCxp();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title:
          mode === "cobro"
            ? "No se pudo registrar el cobro"
            : mode === "pago"
              ? "No se pudo registrar el pago"
              : "No se pudo aplicar la nota de credito",
        description: error?.message || "Error inesperado al guardar la liquidacion.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = isLoadingCxc || isLoadingCxp || isLoadingClientes || isLoadingProveedores;
  const modeLabels =
    mode === "cobro"
      ? {
          title: "Liquidacion de cobros",
          description: "Seleccione una o varias cuentas por cobrar del mismo cliente y moneda.",
          action: "Registrar liquidacion",
          thirdPartyLabel: "Cliente",
          searchPlaceholder: "Buscar por cliente, documento o zafra...",
          emptyTitle: "No hay cuentas por cobrar pendientes.",
          emptyFilteredTitle: "No se encontraron cuentas por cobrar con ese filtro.",
          accountLabel: "Cuenta financiera de ingreso",
          helper: "Cada documento seleccionado genera su propio cobro. El asiento sale consolidado en una sola liquidacion.",
        }
      : mode === "pago"
        ? {
            title: "Liquidacion de pagos",
            description: "Seleccione una o varias cuentas por pagar del mismo proveedor y moneda.",
            action: "Registrar liquidacion",
            thirdPartyLabel: "Proveedor",
            searchPlaceholder: "Buscar por proveedor, documento o zafra...",
            emptyTitle: "No hay cuentas por pagar pendientes.",
            emptyFilteredTitle: "No se encontraron cuentas por pagar con ese filtro.",
            accountLabel: "Cuenta financiera de egreso",
            helper: "Cada documento seleccionado genera su propio pago. El asiento sale consolidado en una sola liquidacion.",
          }
        : mode === "notaCreditoCobro"
          ? {
              title: "Notas de credito sobre cobros",
              description: "Aplique notas de credito o descuentos sobre cuentas por cobrar del mismo cliente.",
              action: "Aplicar nota de credito",
              thirdPartyLabel: "Cliente",
              searchPlaceholder: "Buscar por cliente, documento o zafra...",
              emptyTitle: "No hay cuentas por cobrar pendientes.",
              emptyFilteredTitle: "No se encontraron cuentas por cobrar con ese filtro.",
              accountLabel: "Cuenta contrapartida",
              helper: "La nota de credito no mueve caja. Ajusta saldo pendiente y genera el asiento contable.",
            }
          : {
              title: "Notas de credito sobre pagos",
              description: "Aplique notas de credito o descuentos sobre cuentas por pagar del mismo proveedor.",
              action: "Aplicar nota de credito",
              thirdPartyLabel: "Proveedor",
              searchPlaceholder: "Buscar por proveedor, documento o zafra...",
              emptyTitle: "No hay cuentas por pagar pendientes.",
              emptyFilteredTitle: "No se encontraron cuentas por pagar con ese filtro.",
              accountLabel: "Cuenta contrapartida",
              helper: "La nota de credito no mueve caja. Ajusta saldo pendiente y genera el asiento contable.",
            };

  return (
    <>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Tabs value={mode} onValueChange={(value) => setMode(value as OperationMode)}>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-1">
                <CardTitle>Ventana financiera</CardTitle>
                <CardDescription>
                  Flujo de tesoreria con tabla de pendientes y liquidacion multiple por documento.
                </CardDescription>
              </div>
              <TabsList className="h-auto w-full justify-start overflow-x-auto md:w-auto">
                <TabsTrigger value="cobro">Cobros</TabsTrigger>
                <TabsTrigger value="pago">Pagos</TabsTrigger>
                <TabsTrigger value="notaCreditoCobro">NC Cobros</TabsTrigger>
                <TabsTrigger value="notaCreditoPago">NC Pagos</TabsTrigger>
              </TabsList>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-background/60 p-4">
                <p className="text-sm text-muted-foreground">Pendiente por cobrar</p>
                <p className="mt-1 text-lg font-semibold">USD {formatCurrency(totalPorCobrar.USD)}</p>
                <p className="text-lg font-semibold">PYG {formatCurrency(totalPorCobrar.PYG)}</p>
                <p className="text-xs text-muted-foreground">{pendingCobros.length} documento(s) abiertos</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-4">
                <p className="text-sm text-muted-foreground">Pendiente por pagar</p>
                <p className="mt-1 text-lg font-semibold">USD {formatCurrency(totalPorPagar.USD)}</p>
                <p className="text-lg font-semibold">PYG {formatCurrency(totalPorPagar.PYG)}</p>
                <p className="text-xs text-muted-foreground">{pendingPagos.length} documento(s) abiertos</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-4">
                <p className="text-sm text-muted-foreground">Posicion neta pendiente</p>
                <p className="mt-1 text-lg font-semibold">
                  {totalPorCobrar.USD - totalPorPagar.USD >= 0 ? "+" : "-"}USD{" "}
                  {formatCurrency(Math.abs(totalPorCobrar.USD - totalPorPagar.USD))}
                </p>
                <p className="text-lg font-semibold">
                  {totalPorCobrar.PYG - totalPorPagar.PYG >= 0 ? "+" : "-"}PYG{" "}
                  {formatCurrency(Math.abs(totalPorCobrar.PYG - totalPorPagar.PYG))}
                </p>
                <p className="text-xs text-muted-foreground">Cobrar menos pagar, separado por moneda</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-t p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">
                    {documentMode === "cobro" ? "Documentos por cobrar" : "Documentos por pagar"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {filteredRows.length} visible(s) de {activeRows.length} pendiente(s).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectVisible} disabled={filteredRows.length === 0}>
                    Seleccionar visibles
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearSelection} disabled={selectedIds.length === 0}>
                    Limpiar seleccion
                  </Button>
                </div>
              </div>

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={modeLabels.searchPlaceholder}
              />

              {selectionBase && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {isCreditNoteMode ? "Aplicacion actual" : "Liquidacion actual"}: {selectedThirdPartyLabel} | {selectedCurrency}. Solo se habilitan documentos compatibles.
                </div>
              )}

              <div className="overflow-hidden rounded-lg border">
                <Table resizable className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Sel.</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>{modeLabels.thirdPartyLabel}</TableHead>
                      <TableHead>Emision</TableHead>
                      <TableHead>Venc.</TableHead>
                      <TableHead>Zafra</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                          Cargando documentos pendientes...
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && activeRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                          {modeLabels.emptyTitle}
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && activeRows.length > 0 && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                          {modeLabels.emptyFilteredTitle}
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading &&
                      filteredRows.map((row) => {
                        const isSelected = selectedIds.includes(row.id);
                        const isCompatible = isRowCompatible(row);
                        const disabled = !isSelected && !isCompatible;

                        return (
                          <TableRow
                            key={row.id}
                            data-state={isSelected ? "selected" : undefined}
                            className={cn(disabled && "opacity-55")}
                            onClick={() => handleToggleRow(row, !isSelected)}
                          >
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                disabled={disabled}
                                onCheckedChange={(checked) => handleToggleRow(row, checked === true)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{row.documento}</TableCell>
                            <TableCell>{row.terceroNombre}</TableCell>
                            <TableCell>{formatDateLabel(row.fechaEmision)}</TableCell>
                            <TableCell>{formatDateLabel(row.fechaVencimiento)}</TableCell>
                            <TableCell>{row.zafraNombre || "-"}</TableCell>
                            <TableCell>
                              <Badge className={cn("capitalize", getEstadoClassName(row.estado))}>{row.estado}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.moneda} {formatCurrency(row.saldoPendiente)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{modeLabels.title}</h3>
                <p className="text-sm text-muted-foreground">{modeLabels.description}</p>
              </div>

              {selectedDocuments.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Seleccione uno o mas documentos en la tabla para preparar la liquidacion.
                </div>
              )}

              {selectedDocuments.length > 0 && (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border bg-background/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Entidad</p>
                      <p className="mt-1 font-semibold">{selectedThirdPartyLabel}</p>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Moneda</p>
                      <p className="mt-1 font-semibold">{selectedCurrency}</p>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Documentos</p>
                      <p className="mt-1 font-semibold">{selectedDocuments.length}</p>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total a liquidar</p>
                      <p className="mt-1 font-semibold">
                        {selectedCurrency} {formatCurrency(selectedTotal)}
                      </p>
                    </div>
                  </div>

                  <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)}>
                    <TabsList className="h-auto w-full justify-start overflow-x-auto">
                      <TabsTrigger value="cabecera">Cabecera</TabsTrigger>
                      <TabsTrigger value="aplicaciones">Aplicaciones</TabsTrigger>
                      <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    </TabsList>

                    <TabsContent value="cabecera" className="space-y-4 pt-4">
                      <div className={cn("grid gap-3", isCreditNoteMode ? "md:grid-cols-3" : "md:grid-cols-2")}>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Fecha de operacion</label>
                          <Input
                            type="date"
                            value={fechaOperacion}
                            onChange={(event) => setFechaOperacion(event.target.value)}
                          />
                        </div>

                        {isCreditNoteMode && (
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Motivo</label>
                            <Select value={motivoNota} onValueChange={(value) => setMotivoNota(value as CreditNoteReason)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione motivo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="descuento_pronto_pago">Descuento pronto pago</SelectItem>
                                <SelectItem value="nota_credito">Nota de credito</SelectItem>
                                <SelectItem value="bonificacion">Bonificacion</SelectItem>
                                <SelectItem value="ajuste">Ajuste</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-sm font-medium">{modeLabels.accountLabel}</label>
                          {isCreditNoteMode ? (
                            <Select value={cuentaAjusteId} onValueChange={setCuentaAjusteId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione cuenta contrapartida" />
                              </SelectTrigger>
                              <SelectContent>
                                {cuentasAjuste.length === 0 && (
                                  <SelectItem value="sin-ajustes" disabled>
                                    No hay cuentas de ajuste configuradas
                                  </SelectItem>
                                )}
                                {cuentasAjuste.map((cuenta) => (
                                  <SelectItem key={cuenta.id} value={cuenta.id}>
                                    {cuenta.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select value={cuentaFinancieraId} onValueChange={setCuentaFinancieraId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione una caja o banco" />
                              </SelectTrigger>
                              <SelectContent>
                                {cuentasFinancieras.length === 0 && (
                                  <SelectItem value="sin-cuentas" disabled>
                                    No hay cuentas financieras configuradas
                                  </SelectItem>
                                )}
                                {cuentasFinancieras.length > 0 && selectedCurrency && cuentasFinancierasCompatibles.length === 0 && (
                                  <SelectItem value="sin-cuentas-compatibles" disabled>
                                    No hay cuentas caja/banco activas en {selectedCurrency}
                                  </SelectItem>
                                )}
                                {(selectedCurrency ? cuentasFinancierasCompatibles : cuentasFinancieras).map((cuenta) => (
                                  <SelectItem key={cuenta.id} value={cuenta.id}>
                                    {cuenta.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Referencia / observacion</label>
                        <Input
                          value={referencia}
                          onChange={(event) => setReferencia(event.target.value)}
                          placeholder="Ej: pago anticipado, transferencia bancaria, acuerdo de liquidacion..."
                        />
                      </div>

                      {!isCreditNoteMode && selectedCuentaFinanciera && (
                        <div className="overflow-hidden rounded-lg border">
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Cuenta seleccionada</TableCell>
                                <TableCell>{selectedCuentaFinanciera.label}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Moneda configurada</TableCell>
                                <TableCell>{selectedCuentaFinanciera.moneda || "Sin definir"}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {isCreditNoteMode && selectedCuentaAjuste && (
                        <div className="overflow-hidden rounded-lg border">
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Cuenta de ajuste</TableCell>
                                <TableCell>
                                  {selectedCuentaAjuste.codigo} - {selectedCuentaAjuste.nombre}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Tratamiento</TableCell>
                                <TableCell>La nota de credito se registrara contra esta contrapartida.</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="aplicaciones" className="space-y-4 pt-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleFillBalances}>
                          Completar con saldo
                        </Button>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <Table resizable className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Documento</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                              <TableHead className="w-[190px] text-right">Aplicar</TableHead>
                              <TableHead className="text-right">Saldo restante</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedDocuments.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">{row.documento}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.moneda} {formatCurrency(row.saldoPendiente)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={appliedAmounts[row.id] ?? ""}
                                    onChange={(event) =>
                                      setAppliedAmounts((current) => ({
                                        ...current,
                                        [row.id]: event.target.value,
                                      }))
                                    }
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-mono",
                                    row.saldoRestante < -MONEY_TOLERANCE && "text-red-600"
                                  )}
                                >
                                  {row.moneda} {formatCurrency(row.saldoRestante)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedPendingTotal)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedTotal)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedRemainingTotal)}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="resumen" className="space-y-4 pt-4">
                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Concepto</TableHead>
                              <TableHead className="text-right">Importe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Saldo seleccionado</TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedPendingTotal)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Total a aplicar</TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedTotal)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Saldo restante</TableCell>
                              <TableCell className="text-right font-mono">
                                {selectedCurrency} {formatCurrency(selectedRemainingTotal)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vista previa contable</TableHead>
                              <TableHead className="text-right">Debe</TableHead>
                              <TableHead className="text-right">Haber</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {asientoPreview.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                                  Seleccione la cuenta y defina montos para previsualizar el asiento.
                                </TableCell>
                              </TableRow>
                            )}
                            {asientoPreview.map((row) => (
                              <TableRow key={`${row.tipo}-${row.cuentaId}`}>
                                <TableCell>{row.label}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.debe > 0 ? `${selectedCurrency} ${formatCurrency(row.debe)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.haber > 0 ? `${selectedCurrency} ${formatCurrency(row.haber)}` : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          {asientoPreview.length > 0 && (
                            <TableFooter>
                              <TableRow>
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right font-mono">
                                  {selectedCurrency}{" "}
                                  {formatCurrency(asientoPreview.reduce((sum, row) => sum + row.debe, 0))}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {selectedCurrency}{" "}
                                  {formatCurrency(asientoPreview.reduce((sum, row) => sum + row.haber, 0))}
                                </TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {!isCreditNoteMode && currencyMismatch && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      La cuenta financiera seleccionada esta configurada en {selectedCuentaFinanciera?.moneda} y la
                      liquidacion opera en {selectedCurrency}. Elija una cuenta compatible.
                    </div>
                  )}

                  {!isCreditNoteMode && selectedCurrency && cuentasFinancieras.length > 0 && cuentasFinancierasCompatibles.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      No hay cuentas financieras activas en {selectedCurrency}. Esta lista se arma desde Maestro &gt;
                      Ctas Caja/Banco; si la cuenta solo existe en Plan de Cuentas, debe crearla o vincularla alli con
                      tipo y moneda.
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    {modeLabels.helper}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleRegister}
                      disabled={
                        isSaving ||
                        (!isCreditNoteMode && !selectedCuentaFinanciera) ||
                        (isCreditNoteMode && !selectedCuentaAjuste) ||
                        selectedDocuments.length === 0 ||
                        hasInvalidAmounts ||
                        currencyMismatch
                      }
                      className="h-12 px-5"
                    >
                      {isSaving ? "Guardando..." : modeLabels.action}
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        </Tabs>
      </div>

      <Dialog modal={false} open={isReciboOpen} onOpenChange={setIsReciboOpen}>
        <DialogContent draggable className="max-w-[96vw] overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>Recibo de cobro emitido</DialogTitle>
            <DialogDescription>Puede imprimir o descargar en PDF este recibo.</DialogDescription>
            <ReportActions
              reportTitle={ultimoRecibo ? `Recibo ${ultimoRecibo.numero}` : "Recibo de Cobro"}
              reportSummary={reciboSummary}
              imageTargetId={reciboTargetId}
              printTargetId={reciboTargetId}
              documentLabel="Recibo de Cobro"
              showDefaultFooter={false}
            />
          </DialogHeader>

          {ultimoRecibo && (
            <div className="max-h-[calc(92dvh-7rem)] overflow-y-auto overflow-x-hidden px-2 pb-4 sm:px-4 sm:pb-6">
              <ReciboCobroCard recibo={ultimoRecibo} />
            </div>
          )}

          {ultimoRecibo && (
            <div id={reciboTargetId} className="report-export-only">
              <ReciboCobroCard recibo={ultimoRecibo} />
            </div>
          )}

          <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6">
            <Button type="button" variant="outline" onClick={() => setIsReciboOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

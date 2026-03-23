"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { ArrowRight, Loader2, MessageCircle, Mic, SendHorizontal, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { canAccessPathByPermisos } from "@/lib/route-permissions";
import type {
  Cliente,
  CuentaPorCobrar,
  CuentaPorPagar,
  Evento,
  Insumo,
  Parcela,
  Proveedor,
} from "@/lib/types";
import { cn, formatCurrency, formatQuantity } from "@/lib/utils";

type AssistantAction = {
  label: string;
  href: string;
};

type AssistantMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
};

type Intent =
  | { type: "stock"; term: string | null }
  | { type: "estado"; term: string | null }
  | { type: "costo"; term: string | null }
  | { type: "modulo"; term: string | null }
  | { type: "unknown" };

type AuditStatus = "ok" | "forbidden" | "unknown" | "error";

type ResolveResult = {
  message: Omit<AssistantMessage, "id">;
  intentType: Intent["type"];
  term: string | null;
  status: AuditStatus;
};

const QUICK_PROMPT_CATALOG = [
  { text: "Stock de urea", intent: "stock" as const },
  { text: "Estado de cuenta de AgroNorte", intent: "estado" as const },
  { text: "Costo de parcela 1", intent: "costo" as const },
  { text: "Abrir informe de costos", intent: "modulo" as const },
  { text: "Abrir simulador de impuestos", intent: "modulo" as const },
];

const MODULE_SHORTCUTS: Array<{ label: string; href: string; keywords: string[] }> = [
  { label: "Dashboard", href: "/dashboard", keywords: ["inicio", "panel", "dashboard"] },
  { label: "Monitoreo", href: "/dashboard/monitoreo", keywords: ["monitoreo", "monitor"] },
  { label: "Stock", href: "/stock", keywords: ["stock", "inventario", "insumos"] },
  { label: "Parcelas", href: "/parcelas", keywords: ["parcelas", "lotes", "campo"] },
  { label: "Informe de Costos", href: "/agronomia/informe-costos", keywords: ["informe de costos", "costos parcela", "reporte costos"] },
  { label: "Panel Agronomico", href: "/agronomia/panel", keywords: ["agronomia", "panel agronomico"] },
  { label: "Finanzas Dashboard", href: "/finanzas/dashboard", keywords: ["finanzas", "dashboard finanzas"] },
  { label: "Impuestos", href: "/finanzas/impuestos", keywords: ["impuestos", "iva", "ire", "tributario", "simulador impuestos"] },
  { label: "Cuentas por Cobrar", href: "/finanzas/cuentas-cobrar", keywords: ["cuentas cobrar", "cxc", "cobrar"] },
  { label: "Cuentas por Pagar", href: "/finanzas/cuentas-pagar", keywords: ["cuentas pagar", "cxp", "pagar"] },
  { label: "Costos", href: "/finanzas/costos", keywords: ["costos", "gastos"] },
  { label: "Rentabilidad", href: "/finanzas/rentabilidad", keywords: ["rentabilidad", "margen"] },
  { label: "Tesoreria", href: "/finanzas/tesoreria", keywords: ["tesoreria", "caja", "banco"] },
  { label: "Ventas Comercial", href: "/comercial/ventas", keywords: ["ventas", "facturacion ventas"] },
  { label: "Compras Comercial", href: "/comercial/compras", keywords: ["compras", "facturas compras"] },
  { label: "Clientes", href: "/comercial/clientes", keywords: ["clientes", "cartera clientes"] },
  { label: "Proveedores", href: "/comercial/proveedores", keywords: ["proveedores"] },
  { label: "Usuarios", href: "/usuarios", keywords: ["usuarios", "accesos"] },
  { label: "Roles", href: "/roles", keywords: ["roles", "permisos"] },
  { label: "Auditoria", href: "/auditoria", keywords: ["auditoria", "bitacora", "log"] },
  { label: "Configuracion", href: "/configuracion", keywords: ["configuracion", "ajustes"] },
];

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const DUST_SPECS = [
  { top: "10%", left: "18%", delay: "0s", duration: "2.4s" },
  { top: "22%", left: "78%", delay: "0.3s", duration: "3.1s" },
  { top: "74%", left: "16%", delay: "0.2s", duration: "2.7s" },
  { top: "83%", left: "74%", delay: "0.6s", duration: "2.9s" },
  { top: "38%", left: "6%", delay: "0.1s", duration: "2.5s" },
  { top: "56%", left: "88%", delay: "0.9s", duration: "2.8s" },
  { top: "4%", left: "52%", delay: "0.45s", duration: "2.6s" },
  { top: "93%", left: "48%", delay: "0.75s", duration: "2.3s" },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTerm(input: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const raw = match?.[1]?.trim();
    if (raw) return raw;
  }
  return null;
}

function detectIntent(input: string): Intent {
  const normalized = normalize(input);

  if (/\b(abrir|ir|llevar|mostrar|modulo|modulos|informe|report(e|es))\b/.test(normalized)) {
    return {
      type: "modulo",
      term: extractTerm(input, [
        /(?:abrir|mostrar)\s*(?:modulo|modulos|informe|reportes?)?\s*(?:de|del|al|a)?\s*(.+)$/i,
        /(?:ir|llevar(?:me)?)\s*(?:al|a)?\s*(?:modulo|informe)?\s*(.+)$/i,
        /(?:modulo|modulos|informe|reportes?)\s*(?:de|del)?\s*(.+)$/i,
      ]),
    };
  }

  if (/\b(stock|inventario|existencia)\b/.test(normalized)) {
    return {
      type: "stock",
      term: extractTerm(input, [
        /(?:stock|inventario|existencia)\s*(?:de|del|para)?\s*(.+)$/i,
      ]),
    };
  }

  if (/\b(estado de cuenta|saldo|cuentas?)\b/.test(normalized)) {
    return {
      type: "estado",
      term: extractTerm(input, [
        /(?:estado\s+de\s+cuenta|saldo\s+de\s+cuenta|saldo|cuentas?)\s*(?:de|del)?\s*(.+)$/i,
      ]),
    };
  }

  if (/\b(costo|coste|valor)\b/.test(normalized) && /\b(parcela|lote)\b/.test(normalized)) {
    return {
      type: "costo",
      term: extractTerm(input, [
        /(?:costo|coste|valor)\s*(?:de|del|de la)?\s*(?:parcela|lote)\s*(.+)$/i,
      ]),
    };
  }

  return { type: "unknown" };
}

function scoreMatch(fields: string[], term: string): number {
  if (!term) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  const terms = term.split(" ").filter(Boolean);

  for (const field of fields) {
    const normalizedField = normalize(field || "");
    if (!normalizedField) continue;
    if (normalizedField === term) best = Math.min(best, 0);
    else if (normalizedField.startsWith(term)) best = Math.min(best, 1);
    else if (normalizedField.includes(term)) best = Math.min(best, 2);
    else if (terms.length > 1 && terms.every((t) => normalizedField.includes(t))) best = Math.min(best, 3);
  }

  return best;
}

function rankMatches<T>(items: T[], term: string, pickFields: (item: T) => string[]): T[] {
  const normalizedTerm = normalize(term);
  return items
    .map((item) => ({ item, score: scoreMatch(pickFields(item), normalizedTerm) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

function sumBy(items: number[]): number {
  return items.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

function truncate(value: string, max = 320): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function buildWelcomeMessage(): AssistantMessage {
  return {
    id: 1,
    role: "assistant",
    text:
      "Asistente operativo listo.\nPodes consultar stock, estado de cuenta o costo por parcela.\nEjemplo: stock de urea.",
  };
}

function buildMissingTermMessage(topic: "stock" | "estado" | "costo" | "modulo"): Omit<AssistantMessage, "id"> {
  if (topic === "stock") {
    return {
      role: "assistant",
      text: "Indica el producto. Ejemplo: stock de glifosato.",
      actions: [{ label: "Abrir modulo Stock", href: "/stock" }],
    };
  }
  if (topic === "estado") {
    return {
      role: "assistant",
      text: "Indica la entidad. Ejemplo: estado de cuenta de Agro Norte.",
      actions: [
        { label: "Abrir Cuentas por Cobrar", href: "/finanzas/cuentas-cobrar" },
        { label: "Abrir Cuentas por Pagar", href: "/finanzas/cuentas-pagar" },
      ],
    };
  }
  if (topic === "modulo") {
    return {
      role: "assistant",
      text: "Indica el modulo o informe. Ejemplo: abrir informe de costos o ir a finanzas.",
      actions: [
        { label: "Abrir Dashboard", href: "/dashboard" },
        { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
      ],
    };
  }
  return {
    role: "assistant",
    text: "Indica la parcela. Ejemplo: costo de parcela Lote 1.",
    actions: [
      { label: "Abrir Parcelas", href: "/parcelas" },
      { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
    ],
  };
}

function buildForbiddenMessage(topic: "stock" | "estado" | "costo" | "modulo"): Omit<AssistantMessage, "id"> {
  if (topic === "stock") {
    return {
      role: "assistant",
      text: "No tenes permiso para consultar stock. Solicita habilitacion del modulo Stock para tu rol.",
    };
  }
  if (topic === "estado") {
    return {
      role: "assistant",
      text: "No tenes permiso para consultar estados de cuenta. Solicita habilitacion del modulo Finanzas.",
    };
  }
  if (topic === "modulo") {
    return {
      role: "assistant",
      text: "No tenes permiso para abrir ese modulo desde el asistente.",
    };
  }
  return {
    role: "assistant",
    text: "No tenes permiso para consultar costos por parcela. Solicita habilitacion de Agronomia o Finanzas.",
  };
}

export function OperativoAssistant() {
  const tenant = useTenantFirestore();
  const router = useRouter();
  const { user, role, permisos } = useAuth();
  const isAdmin = useMemo(() => normalize(role || "") === "admin", [role]);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [speechOutputSupported, setSpeechOutputSupported] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [buildWelcomeMessage()]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastSpokenAssistantMessageIdRef = useRef(1);
  const nextIdRef = useRef(2);

  const addMessage = useCallback((message: Omit<AssistantMessage, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: nextIdRef.current++ }]);
  }, []);

  const hasPermissionForIntent = useCallback(
    (intentType: Intent["type"]): boolean => {
      if (isAdmin) return true;
      if (intentType === "stock") return Boolean(permisos.stock);
      if (intentType === "estado") return Boolean(permisos.finanzas);
      if (intentType === "costo") return Boolean(permisos.agronomia || permisos.finanzas);
      if (intentType === "modulo") return true;
      return true;
    },
    [isAdmin, permisos]
  );

  const hasRouteAccess = useCallback(
    (href: string): boolean => {
      return canAccessPathByPermisos(href, permisos, role);
    },
    [permisos, role]
  );

  const filterActionsByPermission = useCallback(
    (actions?: AssistantAction[]): AssistantAction[] | undefined => {
      if (!actions?.length) return undefined;
      const filtered = actions.filter((action) => hasRouteAccess(action.href));
      return filtered.length > 0 ? filtered : undefined;
    },
    [hasRouteAccess]
  );

  const persistAudit = useCallback(
    async (payload: {
      prompt: string;
      intentType: Intent["type"];
      term: string | null;
      status: AuditStatus;
      durationMs: number;
      responsePreview?: string;
      errorMessage?: string;
    }) => {
      const auditoriaCol = tenant.collection("auditoriaAsistente");
      if (!auditoriaCol) return;

      try {
        await addDoc(auditoriaCol, {
          prompt: payload.prompt,
          promptNormalizado: normalize(payload.prompt),
          intentType: payload.intentType,
          term: payload.term,
          status: payload.status,
          durationMs: payload.durationMs,
          responsePreview: payload.responsePreview || null,
          errorMessage: payload.errorMessage || null,
          user: {
            id: user?.id || null,
            nombre: user?.nombre || null,
            email: user?.email || null,
            rol: role || null,
          },
          permisos: { ...permisos },
          createdAt: serverTimestamp(),
        });
      } catch (auditError) {
        console.warn("No se pudo registrar auditoria de asistente:", auditError);
      }
    },
    [permisos, role, tenant, user?.email, user?.id, user?.nombre]
  );

  const quickPrompts = useMemo(() => {
    return QUICK_PROMPT_CATALOG.filter((prompt) => hasPermissionForIntent(prompt.intent)).map((prompt) => prompt.text);
  }, [hasPermissionForIntent]);

  useEffect(() => {
    const win = window as any;
    setVoiceSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    const canSpeak = Boolean(win.speechSynthesis && win.SpeechSynthesisUtterance);
    setSpeechOutputSupported(canSpeak);
    setVoiceOutputEnabled(canSpeak);
  }, []);

  const speakAssistantText = useCallback(
    (text: string) => {
      const win = window as any;
      if (!speechOutputSupported || !voiceOutputEnabled || !win.speechSynthesis || !win.SpeechSynthesisUtterance) {
        return;
      }

      const normalizedText = text.replace(/\n+/g, ". ").trim();
      if (!normalizedText) return;

      try {
        const utterance = new win.SpeechSynthesisUtterance(normalizedText);
        utterance.lang = "es-ES";
        utterance.rate = 1;
        utterance.pitch = 1;

        const voices = win.speechSynthesis.getVoices?.() || [];
        const spanishVoice = voices.find((voice: any) => (voice?.lang || "").toLowerCase().startsWith("es"));
        if (spanishVoice) utterance.voice = spanishVoice;

        win.speechSynthesis.cancel();
        win.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Error al reproducir voz del asistente:", error);
      }
    },
    [speechOutputSupported, voiceOutputEnabled]
  );

  const stockHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const insumosCol = tenant.collection("insumos");
      if (!insumosCol) {
        return {
          role: "assistant",
          text: "No hay una empresa activa para consultar stock.",
          actions: [{ label: "Abrir modulo Stock", href: "/stock" }],
        };
      }

      const snapshot = await getDocs(insumosCol);
      const insumos = snapshot.docs.map((doc) => ({ ...(doc.data() as Insumo), id: doc.id }));
      const matches = rankMatches(insumos, term, (insumo) => [
        insumo.nombre,
        insumo.codigo,
        insumo.descripcion,
      ]);

      if (matches.length === 0) {
        return {
          role: "assistant",
          text: `No encontre productos para "${term}". Proba con nombre o codigo exacto.`,
          actions: [{ label: "Abrir modulo Stock", href: "/stock" }],
        };
      }

      const top = matches.slice(0, 3);
      const body = top
        .map((insumo, index) => {
          const stock = Number(insumo.stockActual) || 0;
          const minimo = Number(insumo.stockMinimo) || 0;
          const unidad = insumo.unidad || "";
          return `${index + 1}. ${insumo.nombre} (${insumo.codigo || "sin codigo"}) - Stock: ${formatQuantity(stock)} ${unidad} | Minimo: ${formatQuantity(minimo)}`;
        })
        .join("\n");

      const actions: AssistantAction[] = [{ label: "Abrir modulo Stock", href: "/stock" }];
      if (top.length === 1) {
        actions.push({ label: "Ver ficha del producto", href: `/stock/insumos/${top[0].id}` });
      }

      return {
        role: "assistant",
        text: `Resultado de stock para "${term}":\n${body}`,
        actions,
      };
    },
    [tenant]
  );

  const estadoHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const clientesCol = tenant.collection("clientes");
      const proveedoresCol = tenant.collection("proveedores");
      const cobrarCol = tenant.collection("cuentasPorCobrar");
      const pagarCol = tenant.collection("cuentasPorPagar");
      if (!clientesCol || !proveedoresCol || !cobrarCol || !pagarCol) {
        return {
          role: "assistant",
          text: "No hay una empresa activa para consultar estados de cuenta.",
          actions: [
            { label: "Abrir Cuentas por Cobrar", href: "/finanzas/cuentas-cobrar" },
            { label: "Abrir Cuentas por Pagar", href: "/finanzas/cuentas-pagar" },
          ],
        };
      }

      const [clientesSnap, proveedoresSnap, cobrarSnap, pagarSnap] = await Promise.all([
        getDocs(clientesCol),
        getDocs(proveedoresCol),
        getDocs(cobrarCol),
        getDocs(pagarCol),
      ]);

      const clientes = clientesSnap.docs.map((doc) => ({ ...(doc.data() as Cliente), id: doc.id }));
      const proveedores = proveedoresSnap.docs.map((doc) => ({ ...(doc.data() as Proveedor), id: doc.id }));
      const cuentasPorCobrar = cobrarSnap.docs.map((doc) => ({ ...(doc.data() as CuentaPorCobrar), id: doc.id }));
      const cuentasPorPagar = pagarSnap.docs.map((doc) => ({ ...(doc.data() as CuentaPorPagar), id: doc.id }));

      const matchedClientes = rankMatches(clientes, term, (cliente) => [cliente.nombre, cliente.ruc, cliente.id]).slice(0, 2);
      const matchedProveedores = rankMatches(proveedores, term, (proveedor) => [proveedor.nombre, proveedor.ruc, proveedor.id]).slice(0, 2);

      if (matchedClientes.length === 0 && matchedProveedores.length === 0) {
        return {
          role: "assistant",
          text: `No encontre la entidad "${term}" en clientes o proveedores.`,
          actions: [
            { label: "Abrir Cuentas por Cobrar", href: "/finanzas/cuentas-cobrar" },
            { label: "Abrir Cuentas por Pagar", href: "/finanzas/cuentas-pagar" },
          ],
        };
      }

      const clientLines = matchedClientes.map((cliente) => {
        const cuentas = cuentasPorCobrar.filter((cuenta) => cuenta.clienteId === cliente.id);
        const pendiente = sumBy(cuentas.map((cuenta) => Number(cuenta.saldoPendiente) || 0));
        const vencido = sumBy(
          cuentas
            .filter((cuenta) => cuenta.estado === "vencida")
            .map((cuenta) => Number(cuenta.saldoPendiente) || 0)
        );
        return `Cliente ${cliente.nombre}: pendiente $${formatCurrency(pendiente)}, vencido $${formatCurrency(vencido)}, cuentas ${cuentas.length}.`;
      });

      const providerLines = matchedProveedores.map((proveedor) => {
        const cuentas = cuentasPorPagar.filter((cuenta) => cuenta.proveedorId === proveedor.id);
        const pendiente = sumBy(cuentas.map((cuenta) => Number(cuenta.saldoPendiente) || 0));
        const vencido = sumBy(
          cuentas
            .filter((cuenta) => cuenta.estado === "vencida")
            .map((cuenta) => Number(cuenta.saldoPendiente) || 0)
        );
        return `Proveedor ${proveedor.nombre}: pendiente $${formatCurrency(pendiente)}, vencido $${formatCurrency(vencido)}, cuentas ${cuentas.length}.`;
      });

      const sections: string[] = [];
      if (clientLines.length > 0) {
        sections.push("Cuentas por cobrar:", ...clientLines);
      }
      if (providerLines.length > 0) {
        sections.push("Cuentas por pagar:", ...providerLines);
      }

      const actions: AssistantAction[] = [];
      if (clientLines.length > 0) actions.push({ label: "Abrir Cuentas por Cobrar", href: "/finanzas/cuentas-cobrar" });
      if (providerLines.length > 0) actions.push({ label: "Abrir Cuentas por Pagar", href: "/finanzas/cuentas-pagar" });

      return {
        role: "assistant",
        text: `Estado de cuenta para "${term}":\n${sections.join("\n")}`,
        actions,
      };
    },
    [tenant]
  );

  const costoHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const parcelasCol = tenant.collection("parcelas");
      const eventosCol = tenant.collection("eventos");
      if (!parcelasCol || !eventosCol) {
        return {
          role: "assistant",
          text: "No hay una empresa activa para consultar costos por parcela.",
          actions: [
            { label: "Abrir Parcelas", href: "/parcelas" },
            { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
          ],
        };
      }

      const [parcelasSnap, eventosSnap] = await Promise.all([
        getDocs(parcelasCol),
        getDocs(eventosCol),
      ]);

      const parcelas = parcelasSnap.docs.map((doc) => ({ ...(doc.data() as Parcela), id: doc.id }));
      const eventos = eventosSnap.docs.map((doc) => ({ ...(doc.data() as Evento), id: doc.id }));
      const matches = rankMatches(parcelas, term, (parcela) => [
        parcela.nombre,
        parcela.codigo,
        parcela.ubicacion || "",
      ]);

      if (matches.length === 0) {
        return {
          role: "assistant",
          text: `No encontre parcelas para "${term}".`,
          actions: [
            { label: "Abrir Parcelas", href: "/parcelas" },
            { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
          ],
        };
      }

      const top = matches.slice(0, 3).map((parcela) => {
        const eventosParcela = eventos.filter((evento) => evento.parcelaId === parcela.id);
        const costoTotal = sumBy(eventosParcela.map((evento) => Number(evento.costoTotal) || 0));
        const superficie = Number(parcela.superficie) || 0;
        const costoPorHa = superficie > 0 ? costoTotal / superficie : 0;
        const eventosConCosto = eventosParcela.filter((evento) => (Number(evento.costoTotal) || 0) > 0).length;

        return {
          parcela,
          costoTotal,
          costoPorHa,
          eventosConCosto,
        };
      });

      const body = top
        .map(
          (item, index) =>
            `${index + 1}. ${item.parcela.nombre} (${item.parcela.codigo || "sin codigo"}) - Costo total: $${formatCurrency(
              item.costoTotal
            )} | Costo/ha: $${formatCurrency(item.costoPorHa)} | Eventos con costo: ${item.eventosConCosto}`
        )
        .join("\n");

      const actions: AssistantAction[] = [{ label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" }];
      if (top.length === 1) {
        actions.push({ label: "Ver reporte de la parcela", href: `/parcelas/${top[0].parcela.id}` });
      } else {
        actions.push({ label: "Abrir modulo Parcelas", href: "/parcelas" });
      }

      return {
        role: "assistant",
        text: `Costo por parcela para "${term}":\n${body}`,
        actions,
      };
    },
    [tenant]
  );

  const moduloHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const matches = rankMatches(MODULE_SHORTCUTS, term, (shortcut) => [
        shortcut.label,
        shortcut.href,
        ...shortcut.keywords,
      ]);

      const uniqueMatches = Array.from(new Map(matches.map((item) => [item.href, item])).values());

      if (uniqueMatches.length === 0) {
        return {
          role: "assistant",
          text: `No encontre modulo o informe para "${term}".`,
          actions: [
            { label: "Abrir Dashboard", href: "/dashboard" },
            { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
          ],
        };
      }

      const top = uniqueMatches.slice(0, 5);
      if (top.length === 1) {
        const target = top[0];
        return {
          role: "assistant",
          text: `Modulo encontrado: ${target.label}.`,
          actions: [{ label: `Abrir ${target.label}`, href: target.href }],
        };
      }

      return {
        role: "assistant",
        text: `Coincidencias para "${term}":\n${top.map((item, index) => `${index + 1}. ${item.label}`).join("\n")}`,
        actions: top.map((item) => ({ label: `Abrir ${item.label}`, href: item.href })),
      };
    },
    []
  );

  const resolvePrompt = useCallback(
    async (prompt: string): Promise<ResolveResult> => {
      const intent = detectIntent(prompt);

      if (intent.type === "stock") {
        if (!hasPermissionForIntent("stock")) {
          return {
            message: buildForbiddenMessage("stock"),
            intentType: "stock",
            term: intent.term,
            status: "forbidden",
          };
        }
        if (!intent.term) {
          return {
            message: buildMissingTermMessage("stock"),
            intentType: "stock",
            term: null,
            status: "ok",
          };
        }
        return {
          message: await stockHandler(intent.term),
          intentType: "stock",
          term: intent.term,
          status: "ok",
        };
      }

      if (intent.type === "estado") {
        if (!hasPermissionForIntent("estado")) {
          return {
            message: buildForbiddenMessage("estado"),
            intentType: "estado",
            term: intent.term,
            status: "forbidden",
          };
        }
        if (!intent.term) {
          return {
            message: buildMissingTermMessage("estado"),
            intentType: "estado",
            term: null,
            status: "ok",
          };
        }
        return {
          message: await estadoHandler(intent.term),
          intentType: "estado",
          term: intent.term,
          status: "ok",
        };
      }

      if (intent.type === "costo") {
        if (!hasPermissionForIntent("costo")) {
          return {
            message: buildForbiddenMessage("costo"),
            intentType: "costo",
            term: intent.term,
            status: "forbidden",
          };
        }
        if (!intent.term) {
          return {
            message: buildMissingTermMessage("costo"),
            intentType: "costo",
            term: null,
            status: "ok",
          };
        }
        return {
          message: await costoHandler(intent.term),
          intentType: "costo",
          term: intent.term,
          status: "ok",
        };
      }

      if (intent.type === "modulo") {
        if (!intent.term) {
          return {
            message: buildMissingTermMessage("modulo"),
            intentType: "modulo",
            term: null,
            status: "ok",
          };
        }

        const moduleResponse = await moduloHandler(intent.term);
        const allowedActions = moduleResponse.actions?.filter((action) => hasRouteAccess(action.href));
        if (!isAdmin && moduleResponse.actions?.length && (!allowedActions || allowedActions.length === 0)) {
          return {
            message: buildForbiddenMessage("modulo"),
            intentType: "modulo",
            term: intent.term,
            status: "forbidden",
          };
        }

        return {
          message: {
            ...moduleResponse,
            ...(allowedActions ? { actions: allowedActions } : {}),
          },
          intentType: "modulo",
          term: intent.term,
          status: "ok",
        };
      }

      return {
        message: {
          role: "assistant",
          text:
            "Todavia no entiendo esa consulta. Proba con:\n- stock de [producto]\n- estado de cuenta de [entidad]\n- costo de parcela [nombre]\n- abrir [modulo o informe]",
          actions: [
            { label: "Abrir Dashboard", href: "/dashboard" },
            { label: "Abrir modulo Stock", href: "/stock" },
          ],
        },
        intentType: "unknown",
        term: null,
        status: "unknown",
      };
    },
    [costoHandler, estadoHandler, hasPermissionForIntent, hasRouteAccess, isAdmin, moduloHandler, stockHandler]
  );

  const submitPrompt = useCallback(
    async (forcedPrompt?: string) => {
      const prompt = (forcedPrompt ?? input).trim();
      if (!prompt || isLoading) return;

      addMessage({ role: "user", text: prompt });
      setInput("");
      setIsLoading(true);
      const startedAt = performance.now();

      try {
        const response = await resolvePrompt(prompt);
        const actions = filterActionsByPermission(response.message.actions);
        addMessage({
          ...response.message,
          ...(actions ? { actions } : {}),
        });
        const durationMs = Math.round(performance.now() - startedAt);
        await persistAudit({
          prompt,
          intentType: response.intentType,
          term: response.term,
          status: response.status,
          durationMs,
          responsePreview: truncate(response.message.text),
        });
      } catch (error: any) {
        const failureText = `No pude completar la consulta. ${error?.message || "Intenta de nuevo."}`;
        addMessage({
          role: "assistant",
          text: failureText,
        });
        const durationMs = Math.round(performance.now() - startedAt);
        await persistAudit({
          prompt,
          intentType: "unknown",
          term: null,
          status: "error",
          durationMs,
          responsePreview: truncate(failureText),
          errorMessage: error?.message || "Error desconocido",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addMessage, filterActionsByPermission, input, isLoading, persistAudit, resolvePrompt]
  );

  const toggleVoiceCapture = useCallback(() => {
    if (isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as any;
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setVoiceSupported(false);
      addMessage({
        role: "assistant",
        text: "Tu navegador no soporta captura de audio para este asistente.",
      });
      return;
    }

    try {
      const recognition: SpeechRecognitionInstance = new RecognitionCtor();
      recognition.lang = "es-ES";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.() || "";
        if (!transcript) return;
        setInput(transcript);
        void submitPrompt(transcript);
      };
      recognition.onerror = () => {
        setIsListening(false);
        addMessage({
          role: "assistant",
          text: "No pude capturar el audio. Intenta de nuevo.",
        });
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setVoiceSupported(true);
      recognition.start();
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
      addMessage({
        role: "assistant",
        text: "No se pudo iniciar el microfono en este navegador.",
      });
      console.error("Error iniciando reconocimiento de voz:", error);
    }
  }, [addMessage, isListening, isLoading, submitPrompt]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    if (lastMessage.id <= lastSpokenAssistantMessageIdRef.current) return;

    lastSpokenAssistantMessageIdRef.current = lastMessage.id;
    speakAssistantText(lastMessage.text);
  }, [messages, speakAssistantText]);

  useEffect(() => {
    if (voiceOutputEnabled) return;
    const win = window as any;
    win.speechSynthesis?.cancel?.();
  }, [voiceOutputEnabled]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const win = window as any;
      win.speechSynthesis?.cancel?.();
    };
  }, []);

  const panelClassName = useMemo(
    () =>
      cn(
        "mb-3 w-[min(94vw,410px)] rounded-2xl border border-border/70 bg-card shadow-2xl",
        "overflow-hidden backdrop-blur-sm"
      ),
    []
  );

  return (
    <div className="fixed bottom-4 right-4 z-[70] no-print">
      {isOpen && (
        <section className={panelClassName} aria-label="Asistente operativo">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">Asistente operativo</p>
                <p className="text-xs text-muted-foreground">Consulta datos y abre modulos</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVoiceOutputEnabled((prev) => !prev)}
                disabled={!speechOutputSupported}
                aria-label={voiceOutputEnabled ? "Silenciar respuestas" : "Activar respuestas por voz"}
                title={voiceOutputEnabled ? "Silenciar respuestas" : "Activar respuestas por voz"}
              >
                {voiceOutputEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Cerrar asistente">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div ref={scrollRef} className="max-h-[52vh] space-y-3 overflow-y-auto bg-muted/20 px-3 py-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn("max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-line", {
                  "ml-auto bg-primary text-primary-foreground": message.role === "user",
                  "mr-auto border bg-card text-card-foreground": message.role === "assistant",
                })}
              >
                <p>{message.text}</p>
                {!!message.actions?.length && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Button
                        key={`${message.id}-${action.href}-${action.label}`}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          router.push(action.href);
                          setIsOpen(false);
                        }}
                      >
                        {action.label}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {isLoading && (
              <div className="mr-auto flex max-w-[80%] items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando datos...
              </div>
            )}
          </div>

          <footer className="space-y-2 border-t bg-card px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={isLoading}
                  onClick={() => submitPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe tu consulta..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitPrompt();
                  }
                }}
              />
              <Button
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleVoiceCapture}
                disabled={isLoading || !voiceSupported}
                title={isListening ? "Detener audio" : "Hablar por audio"}
                aria-label={isListening ? "Detener audio" : "Hablar por audio"}
              >
                <Mic className={cn("h-4 w-4", isListening && "animate-pulse")} />
              </Button>
              <Button size="icon" onClick={() => void submitPrompt()} disabled={isLoading || !input.trim()}>
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
            {isListening && <p className="text-xs text-muted-foreground">Escuchando... habla ahora.</p>}
            {!voiceSupported && (
              <p className="text-xs text-muted-foreground">Microfono no disponible en este navegador.</p>
            )}
            {!speechOutputSupported && (
              <p className="text-xs text-muted-foreground">Voz de salida no disponible en este navegador.</p>
            )}
          </footer>
        </section>
      )}

      <button
        type="button"
        className="carbon-fab relative flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Cerrar asistente" : "Abrir asistente"}
      >
        {DUST_SPECS.map((spec, index) => (
          <span
            key={`${spec.top}-${spec.left}-${index}`}
            className="carbon-dust"
            style={
              {
                top: spec.top,
                left: spec.left,
                animationDelay: spec.delay,
                animationDuration: spec.duration,
              } as CSSProperties
            }
          />
        ))}
        <MessageCircle className="relative z-[2] h-7 w-7" />
      </button>
    </div>
  );
}

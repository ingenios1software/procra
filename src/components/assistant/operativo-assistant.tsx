"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { ArrowRight, Loader2, MessageCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirestore } from "@/firebase";
import { useAuth } from "@/hooks/use-auth";
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
];

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

function buildMissingTermMessage(topic: "stock" | "estado" | "costo"): Omit<AssistantMessage, "id"> {
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
  return {
    role: "assistant",
    text: "Indica la parcela. Ejemplo: costo de parcela Lote 1.",
    actions: [
      { label: "Abrir Parcelas", href: "/parcelas" },
      { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
    ],
  };
}

function buildForbiddenMessage(topic: "stock" | "estado" | "costo"): Omit<AssistantMessage, "id"> {
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
  return {
    role: "assistant",
    text: "No tenes permiso para consultar costos por parcela. Solicita habilitacion de Agronomia o Finanzas.",
  };
}

export function OperativoAssistant() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user, role, permisos } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [buildWelcomeMessage()]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(2);

  const addMessage = useCallback((message: Omit<AssistantMessage, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: nextIdRef.current++ }]);
  }, []);

  const hasPermissionForIntent = useCallback(
    (intentType: Intent["type"]): boolean => {
      if (intentType === "stock") return Boolean(permisos.stock);
      if (intentType === "estado") return Boolean(permisos.finanzas);
      if (intentType === "costo") return Boolean(permisos.agronomia || permisos.finanzas);
      return true;
    },
    [permisos]
  );

  const hasRouteAccess = useCallback(
    (href: string): boolean => {
      const path = href.toLowerCase();
      if (path.startsWith("/stock")) return Boolean(permisos.stock);
      if (path.startsWith("/finanzas")) return Boolean(permisos.finanzas);
      if (path.startsWith("/agronomia")) return Boolean(permisos.agronomia);
      if (path.startsWith("/parcelas")) return Boolean(permisos.maestros || permisos.agronomia || permisos.finanzas);
      return true;
    },
    [permisos]
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
      try {
        await addDoc(collection(firestore, "auditoriaAsistente"), {
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
    [firestore, permisos, role, user?.email, user?.id, user?.nombre]
  );

  const quickPrompts = useMemo(() => {
    return QUICK_PROMPT_CATALOG.filter((prompt) => hasPermissionForIntent(prompt.intent)).map((prompt) => prompt.text);
  }, [hasPermissionForIntent]);

  const stockHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const snapshot = await getDocs(collection(firestore, "insumos"));
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
    [firestore]
  );

  const estadoHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const [clientesSnap, proveedoresSnap, cobrarSnap, pagarSnap] = await Promise.all([
        getDocs(collection(firestore, "clientes")),
        getDocs(collection(firestore, "proveedores")),
        getDocs(collection(firestore, "cuentasPorCobrar")),
        getDocs(collection(firestore, "cuentasPorPagar")),
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
    [firestore]
  );

  const costoHandler = useCallback(
    async (term: string): Promise<Omit<AssistantMessage, "id">> => {
      const [parcelasSnap, eventosSnap] = await Promise.all([
        getDocs(collection(firestore, "parcelas")),
        getDocs(collection(firestore, "eventos")),
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
    [firestore]
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

      return {
        message: {
          role: "assistant",
          text:
            "Todavia no entiendo esa consulta. Proba con:\n- stock de [producto]\n- estado de cuenta de [entidad]\n- costo de parcela [nombre]",
          actions: [
            { label: "Abrir modulo Stock", href: "/stock" },
            { label: "Abrir Informe de Costos", href: "/agronomia/informe-costos" },
          ],
        },
        intentType: "unknown",
        term: null,
        status: "unknown",
      };
    },
    [costoHandler, estadoHandler, hasPermissionForIntent, stockHandler]
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

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

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
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Cerrar asistente">
              <X className="h-4 w-4" />
            </Button>
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
              <Button size="icon" onClick={() => void submitPrompt()} disabled={isLoading || !input.trim()}>
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
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

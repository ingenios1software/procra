"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Database, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { setDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { formatCallableError, useCallableFunction } from "@/firebase/functions";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { cn } from "@/lib/utils";
import {
  buildDnitCacheRecord,
  buildDnitCacheRecordId,
  buildDnitSearchText,
  formatDnitDocument,
  getDnitPrimaryName,
  normalizeDnitSearchText,
} from "@/lib/dnit";
import type { DnitCacheRecord, DnitTaxpayerSnapshot } from "@/lib/types";

type LookupDnitTaxpayerRequest = {
  ruc: string;
};

type LookupDnitTaxpayerResponse = {
  taxpayer: DnitTaxpayerSnapshot;
};

interface DnitLookupPanelProps {
  ruc: string;
  value?: DnitTaxpayerSnapshot | null;
  onApply: (taxpayer: DnitTaxpayerSnapshot) => void;
  disabled?: boolean;
  className?: string;
  entityLabel?: string;
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;

  return (
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function DnitLookupPanel({
  ruc,
  value,
  onApply,
  disabled = false,
  className,
  entityLabel = "registro",
}: DnitLookupPanelProps) {
  const tenant = useTenantFirestore();
  const lookupDnitTaxpayer = useCallableFunction<LookupDnitTaxpayerRequest, LookupDnitTaxpayerResponse>(
    "lookupDnitTaxpayer"
  );
  const cacheCollection = useMemoFirebase(() => tenant.collection("dnitContribuyentes"), [tenant]);
  const { data: cachedTaxpayers, isLoading: isCacheLoading } = useCollection<DnitCacheRecord>(cacheCollection);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DnitTaxpayerSnapshot | null>(value || null);
  const [cacheSearch, setCacheSearch] = useState("");

  useEffect(() => {
    setResult(value || null);
  }, [value]);

  const canLookup = useMemo(() => Boolean(ruc.trim()) && !disabled, [disabled, ruc]);
  const normalizedCacheSearch = useMemo(() => normalizeDnitSearchText(cacheSearch), [cacheSearch]);

  const persistInCache = useCallback(
    (taxpayer: DnitTaxpayerSnapshot) => {
      const cacheDoc = tenant.doc("dnitContribuyentes", buildDnitCacheRecordId(taxpayer));
      if (!cacheDoc) return;

      setDocumentNonBlocking(cacheDoc, buildDnitCacheRecord(taxpayer), { merge: true });
    },
    [tenant]
  );

  const filteredCache = useMemo(() => {
    const items = [...(cachedTaxpayers || [])].sort((left, right) => {
      const leftDate = new Date(String(left.actualizadoEn || left.consultadoEn || 0)).getTime() || 0;
      const rightDate = new Date(String(right.actualizadoEn || right.consultadoEn || 0)).getTime() || 0;
      return rightDate - leftDate;
    });

    if (!normalizedCacheSearch) {
      return items.slice(0, 6);
    }

    return items
      .filter((item) =>
        (item.searchText || buildDnitSearchText(item)).includes(normalizedCacheSearch)
      )
      .slice(0, 8);
  }, [cachedTaxpayers, normalizedCacheSearch]);

  const handleApplyTaxpayer = useCallback(
    (taxpayer: DnitTaxpayerSnapshot) => {
      setResult(taxpayer);
      persistInCache(taxpayer);
      onApply(taxpayer);
    },
    [onApply, persistInCache]
  );

  const handleLookup = async () => {
    if (!canLookup) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await lookupDnitTaxpayer({ ruc: ruc.trim() });
      setResult(response.data.taxpayer);
      persistInCache(response.data.taxpayer);
    } catch (lookupError) {
      const formattedError = formatCallableError(lookupError);
      setError(
        formattedError.includes("functions/internal")
          ? "La consulta DNIT no pudo inicializarse. Verifique DNIT_API_KEY y reinicie o despliegue Firebase Functions."
          : formattedError
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("space-y-3 rounded-xl border bg-muted/20 p-4", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Consulta DNIT</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Consulte el RUC oficial y luego aplique los datos al {entityLabel}.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={handleLookup} disabled={!canLookup || isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Buscar por RUC
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        La consulta oficial usa RUC con digito verificador. Ejemplo: <span className="font-medium">80012345-6</span>
      </p>

      {tenant.isReady && (
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Busqueda local DNIT</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Reutilice contribuyentes ya consultados por su empresa.
              </p>
            </div>
            <Badge variant="outline">{cachedTaxpayers?.length || 0} en cache</Badge>
          </div>

          <Input
            value={cacheSearch}
            onChange={(event) => setCacheSearch(event.target.value)}
            placeholder="Buscar por nombre, razon social o RUC..."
          />

          {isCacheLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando cache local...
            </div>
          ) : filteredCache.length ? (
            <div className="space-y-2">
              {filteredCache.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
                  onClick={() => handleApplyTaxpayer(item)}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{getDnitPrimaryName(item) || item.razonSocial}</p>
                      {item.alias?.trim() && <Badge variant="secondary">{item.alias.trim()}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDnitDocument(item)}</p>
                    {item.nombreComercial && item.nombreComercial !== item.razonSocial && (
                      <p className="text-xs text-muted-foreground">Razon social: {item.razonSocial}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {item.estado && <Badge variant="outline">{item.estado}</Badge>}
                    <span className="text-xs text-muted-foreground">Aplicar</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {cacheSearch.trim()
                ? "No hay coincidencias en la cache local."
                : "Todavia no hay contribuyentes guardados en la cache local."}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-base font-semibold">{getDnitPrimaryName(result)}</p>
              </div>
              <p className="text-sm text-muted-foreground">{formatDnitDocument(result)}</p>
              {result.nombreComercial && result.nombreComercial !== result.razonSocial && (
                <p className="text-sm text-muted-foreground">Razon social: {result.razonSocial}</p>
              )}
            </div>

            {result.estado && <Badge variant="outline">{result.estado}</Badge>}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Categoria" value={result.categoria} />
            <DetailItem label="Tipo persona" value={result.tipoPersona} />
            <DetailItem label="Tipo sociedad" value={result.tipoSociedad} />
            <DetailItem label="Mes cierre" value={result.mesCierre} />
            <DetailItem label="RUC anterior" value={result.rucAnterior} />
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => handleApplyTaxpayer(result)}>
              Aplicar datos DNIT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

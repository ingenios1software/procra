"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteDoc, orderBy, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, Landmark, Save, Trash2, TrendingUp, TriangleAlert } from "lucide-react";
import { useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  buildEvolucionPatrimonialReporte,
  EVOLUCION_PATRIMONIAL_RUBROS,
  getRubroLabel,
  resolveEvolucionPatrimonialCuentaMapping,
  type EvolucionPatrimonialCuentaOverride,
  type EvolucionPatrimonialRubroKey,
} from "@/lib/contabilidad/evolucion-patrimonial";
import type {
  AsientoDiario,
  ConfiguracionEvolucionPatrimonial,
  PlanDeCuenta,
  TipoCambioHistorico,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

type DraftRatesState = Record<string, string>;
type DraftAccountMappingValue = EvolucionPatrimonialRubroKey | "auto" | "ignorar";
type DraftAccountMappingsState = Record<string, DraftAccountMappingValue>;

function formatMoney(moneda: "PYG" | "USD", value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${moneda} ${formatCurrency(value)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${formatCurrency(value)}%`;
}

function formatCellNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return formatCurrency(value);
}

function parseLocalizedNumber(rawValue: string): number | null {
  const value = rawValue.trim().replace(/\s+/g, "");
  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized = value;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = value.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildOverrideFromDraftValue(
  value: DraftAccountMappingValue | undefined
): EvolucionPatrimonialCuentaOverride | undefined {
  if (!value || value === "auto") return undefined;
  if (value === "ignorar") return { ignorar: true };
  return { rubroKey: value };
}

export default function EvolucionPatrimonialPage() {
  const tenant = useTenantFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [draftRates, setDraftRates] = useState<DraftRatesState>({});
  const [processingYear, setProcessingYear] = useState<number | null>(null);
  const [draftAccountMappings, setDraftAccountMappings] = useState<DraftAccountMappingsState>({});
  const [isSavingMappings, setIsSavingMappings] = useState(false);

  const { data: asientos, isLoading: loadingAsientos } = useCollection<AsientoDiario>(
    useMemoFirebase(() => tenant.query("asientosDiario", orderBy("fecha", "asc")), [tenant])
  );
  const { data: planDeCuentas, isLoading: loadingPlan } = useCollection<PlanDeCuenta>(
    useMemoFirebase(() => tenant.query("planDeCuentas", orderBy("codigo")), [tenant])
  );
  const { data: tiposCambio, isLoading: loadingTiposCambio } = useCollection<TipoCambioHistorico>(
    useMemoFirebase(() => tenant.query("tiposCambioHistoricos", orderBy("anio", "asc")), [tenant])
  );
  const configuracionMapeoRef = useMemoFirebase(
    () => tenant.doc("configuracionEvolucionPatrimonial", "default"),
    [tenant]
  );
  const { data: configuracionMapeo, isLoading: loadingConfiguracionMapeo } =
    useDoc<ConfiguracionEvolucionPatrimonial>(configuracionMapeoRef);

  const patrimonioAccounts = useMemo(
    () =>
      (planDeCuentas || [])
        .filter((cuenta) => cuenta.tipo === "patrimonio")
        .sort((a, b) => {
          const codigoCompare = a.codigo.localeCompare(b.codigo, "es");
          if (codigoCompare !== 0) return codigoCompare;
          return a.nombre.localeCompare(b.nombre, "es");
        }),
    [planDeCuentas]
  );

  const persistedAccountMappings = useMemo<DraftAccountMappingsState>(() => {
    const configured = configuracionMapeo?.cuentas || {};
    return patrimonioAccounts.reduce<DraftAccountMappingsState>((accumulator, cuenta) => {
      const value = configured[cuenta.id];
      if (value?.ignorar) {
        accumulator[cuenta.id] = "ignorar";
      } else if (value?.rubroKey) {
        accumulator[cuenta.id] = value.rubroKey;
      } else {
        accumulator[cuenta.id] = "auto";
      }
      return accumulator;
    }, {});
  }, [configuracionMapeo?.cuentas, patrimonioAccounts]);

  useEffect(() => {
    setDraftAccountMappings(persistedAccountMappings);
  }, [persistedAccountMappings]);

  const cuentaOverrides = useMemo(
    () =>
      patrimonioAccounts.reduce<Record<string, EvolucionPatrimonialCuentaOverride | undefined>>((accumulator, cuenta) => {
        accumulator[cuenta.id] = buildOverrideFromDraftValue(draftAccountMappings[cuenta.id]);
        return accumulator;
      }, {}),
    [draftAccountMappings, patrimonioAccounts]
  );

  const tasasCambioPorAnio = useMemo(() => {
    const entries = (tiposCambio || [])
      .map((item) => [Number(item.anio), Number(item.tasa)] as const)
      .filter(([anio, tasa]) => Number.isFinite(anio) && Number.isFinite(tasa) && tasa > 0);
    return new Map(entries);
  }, [tiposCambio]);

  const { resumenes, rubrosPatrimoniales, cuentasPatrimoniales, capitalBaseDetectado } = useMemo(
    () =>
      buildEvolucionPatrimonialReporte({
        asientos,
        planDeCuentas,
        tasasCambioPorAnio,
        cuentaOverrides,
      }),
    [asientos, cuentaOverrides, planDeCuentas, tasasCambioPorAnio]
  );

  const cuentasPorAnio = useMemo(
    () =>
      new Map(
        resumenes.map((resumen) => [
          resumen.anio,
          new Map(resumen.cuentasPatrimoniales.map((cuenta) => [cuenta.cuentaId, cuenta.saldoPYG])),
        ])
      ),
    [resumenes]
  );

  const rubrosPorAnio = useMemo(
    () =>
      new Map(
        resumenes.map((resumen) => [
          resumen.anio,
          new Map(resumen.rubrosPatrimoniales.map((rubro) => [rubro.key, rubro])),
        ])
      ),
    [resumenes]
  );

  useEffect(() => {
    const nextDrafts: DraftRatesState = {};
    resumenes.forEach((resumen) => {
      nextDrafts[String(resumen.anio)] =
        resumen.tipoCambioPYGPorUSD !== null ? String(resumen.tipoCambioPYGPorUSD) : "";
    });
    setDraftRates(nextDrafts);
  }, [resumenes]);

  const latestSummary = resumenes.length > 0 ? resumenes[resumenes.length - 1] : null;
  const missingRateYears = resumenes
    .filter((resumen) => resumen.tipoCambioPYGPorUSD === null)
    .map((resumen) => resumen.anio);
  const conciliacionYears = resumenes
    .filter((resumen) => Math.abs(resumen.conciliacionDiferenciaPYG) > 0.01)
    .map((resumen) => resumen.anio);

  const chartData = resumenes.map((resumen) => ({
    anio: String(resumen.anio),
    capitalActualUSD: resumen.capitalActualUSD,
    incrementoSobreCapitalUSD: resumen.incrementoSobreCapitalUSD,
    incrementoCapitalInicialPct: resumen.incrementoSobreCapitalPct,
    incrementoVsAnioAnteriorPct: resumen.variacionInteranualPct,
  }));
  const hasUsdData = chartData.some(
    (row) => row.capitalActualUSD !== null || row.incrementoSobreCapitalUSD !== null
  );

  const shareSummary = latestSummary
    ? `Ejercicio ${latestSummary.anio} | Capital actual: ${formatMoney("PYG", latestSummary.capitalActualPYG)}${
        latestSummary.capitalActualUSD !== null
          ? ` | Equivalente: ${formatMoney("USD", latestSummary.capitalActualUSD)}`
          : ""
      }`
    : "Sin asientos contables para reconstruir la evolucion patrimonial.";

  const manualMappingsCount = patrimonioAccounts.filter(
    (cuenta) => (draftAccountMappings[cuenta.id] || "auto") !== "auto"
  ).length;
  const mappingIsDirty = patrimonioAccounts.some(
    (cuenta) => (draftAccountMappings[cuenta.id] || "auto") !== (persistedAccountMappings[cuenta.id] || "auto")
  );
  const mappingRows = useMemo(
    () =>
      patrimonioAccounts.map((cuenta) => {
        const draftValue = draftAccountMappings[cuenta.id] || "auto";
        const automatico = resolveEvolucionPatrimonialCuentaMapping(cuenta, undefined);
        const efectivo = resolveEvolucionPatrimonialCuentaMapping(cuenta, buildOverrideFromDraftValue(draftValue));
        return {
          cuenta,
          draftValue,
          automatico,
          efectivo,
        };
      }),
    [draftAccountMappings, patrimonioAccounts]
  );

  const isLoading = loadingAsientos || loadingPlan || loadingTiposCambio || loadingConfiguracionMapeo;

  const handleSaveRate = async (anio: number) => {
    const tasa = parseLocalizedNumber(draftRates[String(anio)] || "");
    if (!tasa) {
      toast({
        variant: "destructive",
        title: "Tipo de cambio invalido",
        description: "Ingrese una cotizacion positiva para ese ejercicio.",
      });
      return;
    }

    const ref = tenant.doc("tiposCambioHistoricos", String(anio));
    if (!ref) return;

    setProcessingYear(anio);
    try {
      await setDoc(ref, {
        anio,
        monedaOrigen: "PYG",
        monedaDestino: "USD",
        tasa,
      });
      toast({
        title: "Cotizacion guardada",
        description: `Ejercicio ${anio}: ${formatMoney("PYG", tasa)} por USD 1.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar la cotizacion",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setProcessingYear(null);
    }
  };

  const handleClearRate = async (anio: number) => {
    const ref = tenant.doc("tiposCambioHistoricos", String(anio));
    if (!ref) return;

    setProcessingYear(anio);
    try {
      await deleteDoc(ref);
      setDraftRates((current) => ({ ...current, [String(anio)]: "" }));
      toast({
        title: "Cotizacion eliminada",
        description: `Se quito la conversion PYG/USD del ejercicio ${anio}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar la cotizacion",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setProcessingYear(null);
    }
  };

  const handleSaveMappings = async () => {
    if (!configuracionMapeoRef) return;

    const cuentas = patrimonioAccounts.reduce<NonNullable<ConfiguracionEvolucionPatrimonial["cuentas"]>>(
      (accumulator, cuenta) => {
        const value = draftAccountMappings[cuenta.id] || "auto";
        if (value === "auto") return accumulator;
        accumulator[cuenta.id] = value === "ignorar" ? { ignorar: true } : { rubroKey: value };
        return accumulator;
      },
      {}
    );

    setIsSavingMappings(true);
    try {
      await setDoc(configuracionMapeoRef, {
        cuentas,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user?.email || null,
      });
      toast({
        title: "Mapeo guardado",
        description: `Se guardaron ${Object.keys(cuentas).length} asignaciones manuales para este tenant.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar el mapeo",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleResetDraftMappings = () => {
    setDraftAccountMappings(persistedAccountMappings);
  };

  const handleClearMappings = async () => {
    if (!configuracionMapeoRef) return;

    setIsSavingMappings(true);
    try {
      await deleteDoc(configuracionMapeoRef);
      setDraftAccountMappings(
        patrimonioAccounts.reduce<DraftAccountMappingsState>((accumulator, cuenta) => {
          accumulator[cuenta.id] = "auto";
          return accumulator;
        }, {})
      );
      toast({
        title: "Mapeo restablecido",
        description: "El informe vuelve a funcionar con deteccion automatica por nombre.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo limpiar el mapeo",
        description: error?.message || "Error inesperado.",
      });
    } finally {
      setIsSavingMappings(false);
    }
  };

  if (isLoading) return <p>Cargando evolucion patrimonial...</p>;

  if (resumenes.length === 0) {
    return (
      <>
        <PageHeader
          title="Evolucion Patrimonial"
          description="Reconstruye la evolucion patrimonial anual desde la contabilidad y la convierte a dolares por ejercicio."
        />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay asientos contables con fecha valida para armar este informe.
          </CardContent>
        </Card>
      </>
    );
  }

  const totalColumns = resumenes.length + 1;

  return (
    <>
      <PageHeader
        title="Evolucion Patrimonial"
        description="Resumen anual del capital actual patrimonial en guaranies y su conversion historica a dolares por ejercicio."
      >
        <ReportActions
          reportTitle="Evolucion Patrimonial"
          reportSummary={shareSummary}
          printTargetId="patrimonio-report"
          imageTargetId="patrimonio-chart"
        />
      </PageHeader>

      <div id="patrimonio-report" className="print-area space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contexto del informe</CardTitle>
            <CardDescription>
              La serie se arma con cierres anuales implicitos segun fecha de asiento. La matriz intenta seguir el
              esquema de tu planilla: rubros patrimoniales, resultado del ejercicio, capital actual y espejo en USD.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Ejercicios: {resumenes.length}</Badge>
            <Badge variant="outline">
              Ultimo ejercicio: {latestSummary?.anio} | Capital actual {formatMoney("PYG", latestSummary?.capitalActualPYG)}
            </Badge>
            <Badge variant={manualMappingsCount > 0 ? "secondary" : "outline"}>
              Mapeo manual: {manualMappingsCount}/{patrimonioAccounts.length}
            </Badge>
            <Badge variant={capitalBaseDetectado ? "outline" : "destructive"}>
              {capitalBaseDetectado ? "Capital base detectado" : "Capital base no detectado"}
            </Badge>
            <Badge variant={missingRateYears.length === 0 ? "outline" : "destructive"}>
              Cotizaciones cargadas: {resumenes.length - missingRateYears.length}/{resumenes.length}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                Capital Actual PYG
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney("PYG", latestSummary?.capitalActualPYG)}</p>
              <p className="text-xs text-muted-foreground">Rubros patrimoniales mas resultado del ejercicio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Capital Actual USD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney("USD", latestSummary?.capitalActualUSD)}</p>
              <p className="text-xs text-muted-foreground">
                {latestSummary?.tipoCambioPYGPorUSD
                  ? `TC ${formatMoney("PYG", latestSummary.tipoCambioPYGPorUSD)} por USD 1`
                  : "Falta cargar el tipo de cambio del ultimo ejercicio"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Incremento sobre capital inicial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney("USD", latestSummary?.incrementoSobreCapitalUSD)}</p>
              <p className="text-xs text-muted-foreground">
                {latestSummary?.incrementoSobreCapitalPct !== null &&
                latestSummary?.incrementoSobreCapitalPct !== undefined
                  ? `${formatPercent(latestSummary.incrementoSobreCapitalPct)} sobre capital base`
                  : "No se pudo calcular porque falta capital base o tipo de cambio"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Incremento vs ano anterior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatPercent(latestSummary?.variacionInteranualPct)}</p>
              <p className="text-xs text-muted-foreground">
                Variacion porcentual del capital actual frente al ejercicio anterior
              </p>
            </CardContent>
          </Card>
        </div>

        {(missingRateYears.length > 0 || !capitalBaseDetectado || conciliacionYears.length > 0) && (
          <Card className="border-amber-300/60 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <TriangleAlert className="h-4 w-4" />
                Alertas del informe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-950">
              {missingRateYears.length > 0 ? (
                <p>Faltan tipos de cambio para: {missingRateYears.join(", ")}. Esos anos quedan sin conversion a USD.</p>
              ) : null}
              {!capitalBaseDetectado ? (
                <p>
                  No se detecto una cuenta patrimonial con nombre similar a &quot;capital social&quot;. Si la cuenta
                  existe con otra nomenclatura, asignala manualmente en el bloque de mapeo exacto.
                </p>
              ) : null}
              {conciliacionYears.length > 0 ? (
                <p>
                  En {conciliacionYears.join(", ")} la conciliacion `Activo - Pasivo - Capital actual` no da cero.
                  Puede ser normal si existen asientos de cierre o reclasificaciones de resultado.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Evolucion anual en USD</CardTitle>
              <CardDescription>
                Replica las dos barras principales de la planilla y los dos porcentajes de seguimiento.
              </CardDescription>
            </CardHeader>
            <CardContent id="patrimonio-chart">
              {hasUsdData ? (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" fontSize={12} />
                    <YAxis
                      yAxisId="left"
                      fontSize={12}
                      tickFormatter={(value: number) => `USD ${formatCurrency(value)}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      fontSize={12}
                      tickFormatter={(value: number) => `${formatCurrency(value)}%`}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const rawValue = Array.isArray(value) ? value[0] : value;
                        const numericValue = Number(rawValue);
                        const safeName = String(name);

                        if (!Number.isFinite(numericValue)) return ["-", safeName];
                        if (safeName.includes("%")) return [`${formatCurrency(numericValue)}%`, safeName];
                        return [`USD ${formatCurrency(numericValue)}`, safeName];
                      }}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="capitalActualUSD" name="USS Patrimonio Actual" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="incrementoSobreCapitalUSD" name="USS Incremento del Patrimonio/anio" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="linear" dataKey="incrementoCapitalInicialPct" name="% Incremento/Anio Sobre Capital Inicial" stroke="hsl(var(--chart-4))" strokeWidth={2} />
                    <Line yAxisId="right" type="linear" dataKey="incrementoVsAnioAnteriorPct" name="% Incremento del Patrimonio Sobre Anio Anterior" stroke="hsl(var(--chart-5))" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Carga al menos una cotizacion anual para generar la serie en dolares.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipo de cambio por ejercicio</CardTitle>
              <CardDescription>
                Ingresa la cotizacion de cierre en guaranies por USD. Se guarda por ejercicio para que el historico no
                cambie despues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Anio</TableHead>
                    <TableHead>T/C PYG por USD</TableHead>
                    <TableHead className="text-right">Accion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumenes.map((resumen) => {
                    const yearKey = String(resumen.anio);
                    const isBusy = processingYear === resumen.anio;

                    return (
                      <TableRow key={resumen.anio}>
                        <TableCell className="font-semibold">{resumen.anio}</TableCell>
                        <TableCell>
                          <Input
                            value={draftRates[yearKey] || ""}
                            onChange={(event) =>
                              setDraftRates((current) => ({
                                ...current,
                                [yearKey]: event.target.value,
                              }))
                            }
                            placeholder="Ej: 7.812,22"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => void handleSaveRate(resumen.anio)} disabled={isBusy}>
                              <Save className="mr-2 h-4 w-4" />
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void handleClearRate(resumen.anio)} disabled={isBusy}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Limpiar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Mapeo exacto por cuenta patrimonial</CardTitle>
                <CardDescription>
                  Asigna cada cuenta real del tenant a la fila exacta de la planilla. El informe se recalcula en vivo
                  con este borrador antes de guardar.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleResetDraftMappings} disabled={!mappingIsDirty || isSavingMappings}>
                  Revertir borrador
                </Button>
                <Button variant="outline" onClick={() => void handleClearMappings()} disabled={isSavingMappings}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Todo automatico
                </Button>
                <Button onClick={() => void handleSaveMappings()} disabled={isSavingMappings || !mappingIsDirty}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar mapeo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Cuentas patrimoniales: {patrimonioAccounts.length}</Badge>
              <Badge variant={manualMappingsCount > 0 ? "secondary" : "outline"}>
                Asignaciones manuales: {manualMappingsCount}
              </Badge>
              <Badge variant={mappingIsDirty ? "destructive" : "outline"}>
                {mappingIsDirty ? "Hay cambios sin guardar" : "Mapeo sincronizado"}
              </Badge>
            </div>

            <Table resizable fixedLayout className="min-w-[1180px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[340px]" resizable={false}>
                    Cuenta
                  </TableHead>
                  <TableHead className="min-w-[220px]">Sugerencia automatica</TableHead>
                  <TableHead className="min-w-[220px]">Asignacion actual</TableHead>
                  <TableHead className="min-w-[180px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingRows.map(({ cuenta, draftValue, automatico, efectivo }) => (
                  <TableRow key={`mapping-${cuenta.id}`}>
                    <TableCell className="font-medium">
                      {cuenta.codigo} - {cuenta.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{automatico.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draftValue}
                        onValueChange={(value) =>
                          setDraftAccountMappings((current) => ({
                            ...current,
                            [cuenta.id]: value as DraftAccountMappingValue,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatico ({automatico.label})</SelectItem>
                          <SelectItem value="ignorar">Excluir del informe</SelectItem>
                          {EVOLUCION_PATRIMONIAL_RUBROS.map((rubro) => (
                            <SelectItem key={`mapping-option-${cuenta.id}-${rubro.key}`} value={rubro.key}>
                              {rubro.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={efectivo.origen === "manual" ? "secondary" : "outline"}>
                          {efectivo.origen === "manual" ? "Manual" : "Auto"}
                        </Badge>
                        <Badge variant="outline">{efectivo.label}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriz estilo planilla</CardTitle>
            <CardDescription>
              Primer bloque en PYG y segundo bloque en USD, siguiendo la estructura del archivo real que compartiste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table resizable fixedLayout className="min-w-[1400px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[280px]" resizable={false}>
                    Concepto
                  </TableHead>
                  {resumenes.map((resumen) => (
                    <TableHead key={resumen.anio} className="text-right">
                      {resumen.anio}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrosPatrimoniales.map((rubro) => (
                  <TableRow key={`pyg-${rubro.key}`}>
                    <TableCell className="font-medium">
                      {rubro.label}
                      {rubro.esCapitalBase ? (
                        <Badge variant="outline" className="ml-2">
                          Capital base
                        </Badge>
                      ) : null}
                    </TableCell>
                    {resumenes.map((resumen) => (
                      <TableCell key={`${rubro.key}-${resumen.anio}`} className="text-right font-mono">
                        {formatCellNumber(rubrosPorAnio.get(resumen.anio)?.get(rubro.key)?.saldoPYG)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Resultado del Ejerc.</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`resultado-pyg-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.resultadoEjercicioPYG)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Capital Actual</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`capital-actual-pyg-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.capitalActualPYG)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>T/CAMBIO</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`tc-superior-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.tipoCambioPYGPorUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>DOLARES</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`dolares-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.capitalActualUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>Incremento del Patrimonio /anio:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`incremento-pyg-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.incrementoSobreCapitalPYG)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>% Incremento/Anio Sobre Capital Inicial:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`incremento-capital-pct-${resumen.anio}`} className="text-right font-mono">
                      {resumen.incrementoSobreCapitalPct !== null ? `${formatCurrency(resumen.incrementoSobreCapitalPct)}%` : "-"}
                    </TableCell>
                  ))}
                </TableRow>

                <TableRow className="bg-background hover:bg-background">
                  <TableCell colSpan={totalColumns} className="h-3 border-b-0 p-0" />
                </TableRow>

                <TableRow className="bg-muted/10 font-semibold">
                  <TableCell>TIPO DE CAMBIO:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`tc-inferior-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.tipoCambioPYGPorUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/10">
                  <TableCell>Anio</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`anio-row-${resumen.anio}`} className="text-right font-mono">
                      {resumen.anio}
                    </TableCell>
                  ))}
                </TableRow>
                {rubrosPatrimoniales.map((rubro) => (
                  <TableRow key={`usd-${rubro.key}`}>
                    <TableCell className="font-medium">{rubro.label}</TableCell>
                    {resumenes.map((resumen) => (
                      <TableCell key={`usd-${rubro.key}-${resumen.anio}`} className="text-right font-mono">
                        {formatCellNumber(rubrosPorAnio.get(resumen.anio)?.get(rubro.key)?.saldoUSD)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20 font-semibold">
                  <TableCell>Resultado del Ejerc.</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`resultado-usd-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.resultadoEjercicioUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20 font-semibold">
                  <TableCell>USS Patrimonio Actual:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`capital-actual-usd-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.capitalActualUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>USS Incremento del Patrimonio/anio:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`incremento-usd-${resumen.anio}`} className="text-right font-mono">
                      {formatCellNumber(resumen.incrementoSobreCapitalUSD)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>% Incremento/Anio Sobre Capital Inicial:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`incremento-capital-usd-pct-${resumen.anio}`} className="text-right font-mono">
                      {resumen.incrementoSobreCapitalPct !== null ? `${formatCurrency(resumen.incrementoSobreCapitalPct)}%` : "-"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell>% Incremento del Patrimonio Sobre Anio Anterior:</TableCell>
                  {resumenes.map((resumen) => (
                    <TableCell key={`incremento-anterior-pct-${resumen.anio}`} className="text-right font-mono">
                      {resumen.variacionInteranualPct !== null ? `${formatCurrency(resumen.variacionInteranualPct)}%` : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle anual consolidado</CardTitle>
            <CardDescription>
              Resumen vertical para control rapido del capital actual, su conversion y la diferencia contra Activo -
              Pasivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anio</TableHead>
                  <TableHead className="text-right">Capital social PYG</TableHead>
                  <TableHead className="text-right">Resultado PYG</TableHead>
                  <TableHead className="text-right">Capital actual PYG</TableHead>
                  <TableHead className="text-right">T/C</TableHead>
                  <TableHead className="text-right">Capital actual USD</TableHead>
                  <TableHead className="text-right">Inc. USD</TableHead>
                  <TableHead className="text-right">% cap. inicial</TableHead>
                  <TableHead className="text-right">% anio anterior</TableHead>
                  <TableHead className="text-right">Dif. contable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenes.map((resumen) => {
                  const capitalSocial = rubrosPorAnio.get(resumen.anio)?.get("capital_social")?.saldoPYG ?? null;
                  return (
                    <TableRow key={`detalle-${resumen.anio}`}>
                      <TableCell className="font-semibold">{resumen.anio}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(capitalSocial)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.resultadoEjercicioPYG)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.capitalActualPYG)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.tipoCambioPYGPorUSD)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.capitalActualUSD)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.incrementoSobreCapitalUSD)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPercent(resumen.incrementoSobreCapitalPct)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPercent(resumen.variacionInteranualPct)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCellNumber(resumen.conciliacionDiferenciaPYG)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle por cuenta patrimonial</CardTitle>
            <CardDescription>
              Vista tecnica de las cuentas reales detectadas en CRApro95 para ajustar el mapeo contra tu planilla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table resizable fixedLayout className="min-w-[1400px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[320px]" resizable={false}>
                    Cuenta patrimonial
                  </TableHead>
                  {resumenes.map((resumen) => (
                    <TableHead key={`cuenta-head-${resumen.anio}`} className="text-right">
                      {resumen.anio}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuentasPatrimoniales.map((cuenta) => (
                  <TableRow key={cuenta.cuentaId}>
                    <TableCell className="font-medium">
                      {cuenta.codigo} - {cuenta.nombre}
                      {cuenta.esCapitalBase ? (
                        <Badge variant="outline" className="ml-2">
                          Capital base
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="ml-2">
                        {getRubroLabel(cuenta.rubroKey)}
                      </Badge>
                      <Badge variant={cuenta.origenMapeo === "manual" ? "secondary" : "outline"} className="ml-2">
                        {cuenta.origenMapeo === "manual" ? "Manual" : "Auto"}
                      </Badge>
                    </TableCell>
                    {resumenes.map((resumen) => (
                      <TableCell key={`${cuenta.cuentaId}-${resumen.anio}`} className="text-right font-mono">
                        {formatCellNumber(cuentasPorAnio.get(resumen.anio)?.get(cuenta.cuentaId))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas de lectura</CardTitle>
            <CardDescription>
              Como interpreta CRApro95 este informe para que el dato sea consistente en el tiempo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>El bloque principal sigue la logica de tu Excel: rubros patrimoniales, resultado del ejercicio, capital actual, tipo de cambio y bloque espejo en USD.</p>
            <p>Ahora puedes fijar un mapeo manual por tenant para que cada cuenta patrimonial caiga siempre en la fila correcta aunque la nomenclatura no coincida con la heuristica.</p>
            <p>El resultado del ejercicio se reconstruye con ingresos, costos y gastos del ano; no depende de una sola cuenta patrimonial de cierre.</p>
            <p>La conversion a dolares divide cada ejercicio por su cotizacion historica guardada, para que el historico no cambie cuando se actualiza el dolar actual.</p>
            <p>La columna de diferencia contable muestra la distancia entre `Activo - Pasivo` y `Capital actual` del esquema tipo planilla.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

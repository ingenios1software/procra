"use client";

import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import { AlertCircle, CalendarDays, CheckCircle, SprayCan, Sprout } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EtapaCultivo, Evento, Zafra } from "@/lib/types";
import { getEventDate, getSowingBaseDate } from "@/components/agronomia/panel/panel-evento-utils";

interface EventoAnalisisPanelProps {
  eventoActual: Partial<Evento>;
  todosLosEventos: Evento[];
  zafras: Zafra[];
  etapasCultivo: EtapaCultivo[];
}

type EventoConFecha = { ev: Evento; fecha: Date };

const INTERVALO_RECOMENDADO: Record<string, { min: number; max: number }> = {
  aplicacion: { min: 15, max: 25 },
  fertilizacion: { min: 20, max: 30 },
  riego: { min: 5, max: 10 },
  default: { min: 15, max: 30 },
};

function normalizeTipo(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: number }).seconds;
    if (typeof seconds === "number") {
      const parsed = new Date(seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function sortEventosByFechaDesc(a: EventoConFecha, b: EventoConFecha): number {
  const byDate = b.fecha.getTime() - a.fecha.getTime();
  if (byDate !== 0) return byDate;

  const byLanz = Number(b.ev.numeroLanzamiento || 0) - Number(a.ev.numeroLanzamiento || 0);
  if (byLanz !== 0) return byLanz;

  return Number(b.ev.numeroItem || 0) - Number(a.ev.numeroItem || 0);
}

function getEtapaVigente(etapas: EtapaCultivo[], diasDesdeSiembra: number): EtapaCultivo | undefined {
  const exacta = etapas.find(
    (e) => diasDesdeSiembra >= e.diasDesdeSiembraInicio && diasDesdeSiembra <= e.diasDesdeSiembraFin
  );
  if (exacta) return exacta;

  for (let idx = etapas.length - 1; idx >= 0; idx -= 1) {
    const etapa = etapas[idx];
    if (diasDesdeSiembra >= etapa.diasDesdeSiembraInicio) {
      return etapa;
    }
  }

  return etapas[0];
}

export function EventoAnalisisPanel({
  eventoActual,
  todosLosEventos,
  zafras,
  etapasCultivo,
}: EventoAnalisisPanelProps) {
  const eventoFecha = useMemo(() => toDateSafe(eventoActual.fecha) || new Date(), [eventoActual.fecha]);
  const referenciaAnalisis = useMemo(
    () => (eventoActual.id ? new Date() : eventoFecha),
    [eventoActual.id, eventoFecha]
  );

  const eventosConFecha = useMemo(() => {
    return todosLosEventos
      .map((ev) => ({ ev, fecha: getEventDate(ev) }))
      .filter((item): item is EventoConFecha => !!item.fecha);
  }, [todosLosEventos]);

  const {
    diasDesdeSiembra,
    progresoZafra,
    etapaFisiologica,
    tieneEtapasFenologicas,
    diasEnEtapa,
    proximaEtapa,
    diasParaProximaEtapa,
  } = useMemo(() => {
    const zafra = zafras.find((z) => z.id === eventoActual.zafraId);
    if (!zafra) return { progresoZafra: 0 };

    const eventosContextoConFecha = eventosConFecha
      .filter(
        ({ ev, fecha }) =>
          ev.zafraId === zafra.id &&
          (!eventoActual.parcelaId || ev.parcelaId === eventoActual.parcelaId) &&
          fecha.getTime() <= eventoFecha.getTime()
      )
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const siembraParcela = eventoActual.parcelaId
      ? eventosContextoConFecha.find(({ ev }) => normalizeTipo(ev.tipo).includes("siembra"))?.fecha
      : undefined;

    const eventosContexto = eventosContextoConFecha.map(({ ev }) => ev);

    const baseSiembra =
      siembraParcela ||
      getSowingBaseDate({ ...zafra, fechaSiembra: zafra.fechaSiembra || zafra.fechaInicio }, eventosContexto);
    if (!baseSiembra || Number.isNaN(baseSiembra.getTime())) return { progresoZafra: 0 };

    const dias = Math.max(0, differenceInDays(eventoFecha, baseSiembra));
    const fechaFin = toDateSafe(zafra.fechaFin);
    const duracionPorFecha = fechaFin ? differenceInDays(fechaFin, baseSiembra) : 0;

    const cultivoCandidatos = [zafra.cultivoId, eventoActual.cultivoId]
      .map((value) => normalizeId(value))
      .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

    const etapasDelCultivo =
      cultivoCandidatos
        .map((cultivoId) =>
          etapasCultivo
            .filter((e) => normalizeId(e.cultivoId) === cultivoId)
            .sort((a, b) => a.orden - b.orden)
        )
        .find((etapas) => etapas.length > 0) || [];

    const duracionPorEtapas = etapasDelCultivo.reduce(
      (max, etapa) => Math.max(max, Number(etapa.diasDesdeSiembraFin || 0)),
      0
    );
    const duracionObjetivo = duracionPorFecha > 0 ? duracionPorFecha : duracionPorEtapas;
    const progreso =
      duracionObjetivo > 0
        ? Math.max(0, Math.min(100, Math.round((dias / Math.max(1, duracionObjetivo)) * 100)))
        : undefined;

    const etapaActual = getEtapaVigente(etapasDelCultivo, dias);

    let diasEtapa: number | undefined;
    let siguienteEtapa: string | undefined;
    let diasHastaSiguiente: number | undefined;

    if (etapaActual) {
      diasEtapa = Math.max(0, dias - etapaActual.diasDesdeSiembraInicio);
      const idx = etapasDelCultivo.findIndex((e) => e.id === etapaActual.id);
      if (idx >= 0 && idx < etapasDelCultivo.length - 1) {
        const proxima = etapasDelCultivo[idx + 1];
        siguienteEtapa = proxima.nombre;
        diasHastaSiguiente = Math.max(0, proxima.diasDesdeSiembraInicio - dias);
      }
    }

    return {
      diasDesdeSiembra: dias,
      progresoZafra: progreso,
      etapaFisiologica: etapaActual?.nombre,
      tieneEtapasFenologicas: etapasDelCultivo.length > 0,
      diasEnEtapa: diasEtapa,
      proximaEtapa: siguienteEtapa,
      diasParaProximaEtapa: diasHastaSiguiente,
    };
  }, [
    eventoActual.cultivoId,
    eventoActual.parcelaId,
    eventoActual.zafraId,
    eventoFecha,
    eventosConFecha,
    zafras,
    etapasCultivo,
  ]);

  const {
    ultimoEventoSimilar,
    ultimoEventoParcela,
    diasDesdeUltimoSimilar,
    diasDesdeUltimoEnParcela,
    intervaloStatus,
    recomendado,
  } = useMemo(() => {
    const parcelaId = eventoActual.parcelaId;
    if (!parcelaId) return {};

    const tipoActual = normalizeTipo(eventoActual.tipo as string | undefined);
    const rango = INTERVALO_RECOMENDADO[tipoActual] || INTERVALO_RECOMENDADO.default;

    const eventosPreviosParcela = eventosConFecha
      .filter(({ ev, fecha }) => {
        if (ev.parcelaId !== parcelaId) return false;
        if (eventoActual.zafraId && ev.zafraId !== eventoActual.zafraId) return false;
        if (eventoActual.id && ev.id === eventoActual.id) return false;
        return fecha.getTime() <= referenciaAnalisis.getTime();
      })
      .sort(sortEventosByFechaDesc);

    const ultimoParcela = eventosPreviosParcela[0];
    const diasUltimoParcela = ultimoParcela
      ? Math.max(0, differenceInDays(referenciaAnalisis, ultimoParcela.fecha))
      : undefined;

    if (!tipoActual) {
      return {
        ultimoEventoParcela: ultimoParcela?.ev,
        diasDesdeUltimoEnParcela: diasUltimoParcela,
        recomendado: rango,
      };
    }

    const previosSimilares = eventosPreviosParcela.filter(
      ({ ev }) => normalizeTipo(ev.tipo) === tipoActual
    );
    const ultimo = previosSimilares[0];
    if (!ultimo) {
      return {
        ultimoEventoParcela: ultimoParcela?.ev,
        diasDesdeUltimoEnParcela: diasUltimoParcela,
        recomendado: rango,
      };
    }

    const dias = Math.max(0, differenceInDays(referenciaAnalisis, ultimo.fecha));

    let status: "ok" | "warn" | "danger" = "ok";
    if (dias < rango.min * 0.8 || dias > rango.max * 1.2) {
      status = "danger";
    } else if (dias < rango.min || dias > rango.max) {
      status = "warn";
    }

    return {
      ultimoEventoSimilar: ultimo.ev,
      ultimoEventoParcela: ultimoParcela?.ev,
      diasDesdeUltimoSimilar: dias,
      diasDesdeUltimoEnParcela: diasUltimoParcela,
      intervaloStatus: status,
      recomendado: rango,
    };
  }, [
    eventoActual.id,
    eventoActual.parcelaId,
    eventoActual.tipo,
    eventoActual.zafraId,
    eventosConFecha,
    referenciaAnalisis,
  ]);

  const referenciaHistorial = useMemo(() => {
    // En revision de eventos ya guardados, el historial debe reflejar el estado actual de la parcela.
    return eventoActual.id ? new Date() : eventoFecha;
  }, [eventoActual.id, eventoFecha]);

  const { ultimaActividad, diasDesdeUltimaActividad, eventosUltimos30Dias } = useMemo(() => {
    const parcelaId = eventoActual.parcelaId;
    if (!parcelaId) return {};

    const eventosPreviosParcela = eventosConFecha
      .filter(({ ev, fecha }) => {
        if (ev.parcelaId !== parcelaId) return false;
        if (eventoActual.zafraId && ev.zafraId !== eventoActual.zafraId) return false;
        return fecha.getTime() <= referenciaHistorial.getTime();
      })
      .sort(sortEventosByFechaDesc);

    const ultima = eventosPreviosParcela[0];
    const dias = ultima ? Math.max(0, differenceInDays(referenciaHistorial, ultima.fecha)) : null;

    const treintaDiasAtras = new Date(referenciaHistorial);
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
    const recientes = eventosPreviosParcela.filter(({ fecha }) => fecha > treintaDiasAtras).length;

    return {
      ultimaActividad: ultima?.ev,
      diasDesdeUltimaActividad: dias,
      eventosUltimos30Dias: recientes,
    };
  }, [eventoActual.parcelaId, eventoActual.zafraId, eventosConFecha, referenciaHistorial]);

  if (!eventoActual.parcelaId || !eventoActual.zafraId) {
    return (
      <Card className="mb-6 bg-muted/30 border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Seleccione una parcela y una zafra para ver el analisis agronomico.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <Sprout className="w-8 h-8 text-primary" />
          <CardTitle className="text-lg">Ciclo del Cultivo</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          {diasDesdeSiembra !== undefined ? (
            <>
              <div className="text-sm">
                <span className="font-semibold">Dias desde siembra:</span> {diasDesdeSiembra} dias
              </div>
              <div className="text-sm">
                <span className="font-semibold">Etapa Fisiologica:</span>{" "}
                {etapaFisiologica || (
                  <span className="text-muted-foreground italic">
                    {tieneEtapasFenologicas
                      ? "No definida para el dia actual"
                      : "No definida (sin etapas cargadas para este cultivo)"}
                  </span>
                )}
              </div>
              {diasEnEtapa !== undefined && (
                <div className="text-sm">
                  <span className="font-semibold">Dias en esta etapa:</span> {diasEnEtapa}
                </div>
              )}
              {proximaEtapa && (
                <div className="text-sm">
                  <span className="font-semibold">Proxima etapa:</span> {proximaEtapa} (en ~
                  {diasParaProximaEtapa} dias)
                </div>
              )}
              {progresoZafra !== undefined ? (
                <div className="pt-2">
                  <label className="text-sm font-medium">Progreso de la zafra: {progresoZafra}%</label>
                  <Progress value={progresoZafra} className="h-2 mt-1" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Progreso no disponible: configure etapas fenologicas o fecha de fin en la zafra.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No se encontro la fecha de siembra para esta zafra.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <SprayCan className="w-8 h-8 text-primary" />
          <CardTitle className="text-lg">Intervalo entre Eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          {ultimoEventoSimilar ? (
            <>
              <div className="text-sm">
                <span className="font-semibold">Ultima aplicacion similar:</span>{" "}
                {diasDesdeUltimoSimilar} dias atras
              </div>
              <div className="text-sm">
                <span className="font-semibold">Intervalo recomendado:</span> {recomendado?.min ?? INTERVALO_RECOMENDADO.default.min}-{recomendado?.max ?? INTERVALO_RECOMENDADO.default.max} dias
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Estado:</span>
                {intervaloStatus === "ok" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    En Rango
                  </Badge>
                )}
                {intervaloStatus === "warn" && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Advertencia
                  </Badge>
                )}
                {intervaloStatus === "danger" && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Fuera de Rango
                  </Badge>
                )}
              </div>
              <div className="h-[60px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[{ name: "intervalo", dias: diasDesdeUltimoSimilar }]}
                    layout="vertical"
                    margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
                  >
                    <YAxis type="category" dataKey="name" hide />
                    <XAxis
                      type="number"
                      domain={[0, Math.max(30, diasDesdeUltimoSimilar || 0) + 5]}
                      hide
                    />
                    <Bar dataKey="dias" fill="hsl(var(--primary))" barSize={10} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : ultimoEventoParcela ? (
            <>
              <div className="text-sm">
                <span className="font-semibold">Ultimo evento en la parcela:</span>{" "}
                {diasDesdeUltimoEnParcela} dias atras ({ultimoEventoParcela.tipo})
              </div>
              <div className="text-sm">
                <span className="font-semibold">Intervalo recomendado:</span> {recomendado?.min ?? INTERVALO_RECOMENDADO.default.min}-{recomendado?.max ?? INTERVALO_RECOMENDADO.default.max} dias
              </div>
              <p className="text-xs text-muted-foreground">
                No hay eventos previos del mismo tipo para calcular un intervalo comparable.
              </p>
              <div className="h-[60px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[{ name: "intervalo", dias: diasDesdeUltimoEnParcela ?? 0 }]}
                    layout="vertical"
                    margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
                  >
                    <YAxis type="category" dataKey="name" hide />
                    <XAxis
                      type="number"
                      domain={[0, Math.max(30, diasDesdeUltimoEnParcela || 0) + 5]}
                      hide
                    />
                    <Bar dataKey="dias" fill="hsl(var(--primary))" barSize={10} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Primera aplicacion de este tipo en la parcela.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <CalendarDays className="w-8 h-8 text-primary" />
          <CardTitle className="text-lg">Historial de Actividad</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          {ultimaActividad ? (
            <>
              <div className="text-sm">
                <span className="font-semibold">Ultima actividad:</span> {diasDesdeUltimaActividad} dias atras ({ultimaActividad.tipo})
              </div>
              {diasDesdeUltimaActividad !== null &&
                diasDesdeUltimaActividad !== undefined &&
                diasDesdeUltimaActividad > 15 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 p-2 bg-amber-50 rounded-md">
                    <AlertCircle className="w-4 h-4" />
                    <p>Mas de 15 dias sin actividad registrada.</p>
                  </div>
                )}
              <div className="text-sm">
                <span className="font-semibold">Eventos en los ultimos 30 dias:</span>{" "}
                {eventosUltimos30Dias}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin eventos previos en esta parcela.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

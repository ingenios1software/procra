"use client";

import type { Evento, Zafra } from "@/lib/types";
import { differenceInDays } from "date-fns";
import { getEventTypeDisplay, getTipoBaseFromEvento } from "@/lib/eventos/tipos";

function toDate(value: unknown): Date | null {
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

function normalizeText(value: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getEventCategoryLabel(evento: Pick<Evento, "categoria" | "tipo" | "tipoNombre">): string {
  const base = (evento.categoria || evento.tipo || "").toString();
  const key = normalizeText(base);

  if (!key) return "Otros";
  if (key.includes("siembra")) return "Siembra";
  if (key.includes("aplic")) return "Aplicacion";
  if (key.includes("fertiliz")) return "Fertilizacion";
  if (key.includes("riego")) return "Riego";
  if (key.includes("cosecha")) return "Cosecha";
  if (key.includes("plaga")) return "Control de Plagas";
  if (key.includes("mantenimiento")) return "Mantenimiento";
  if (key.includes("rendimiento")) return "Rendimiento";
  if (key.includes("fungic")) return "Fungicida";
  if (key.includes("insect")) return "Insecticida";
  if (key.includes("herbic")) return "Herbicida";
  if (key.includes("desec")) return "Desecacion";

  return getEventTypeDisplay(evento);
}

export function groupCostsByEventCategory(eventos: Evento[]): Array<{ name: string; value: number }> {
  const totals = eventos.reduce((acc, ev) => {
    const category = getEventCategoryLabel(ev);
    acc[category] = (acc[category] || 0) + (ev.costoTotal || 0);
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function getEventDate(evento: Pick<Evento, "fecha">): Date | null {
  return toDate(evento.fecha);
}

export function getSowingBaseDate(zafra: Zafra, eventos: Evento[]): Date {
  const fromZafra = toDate(zafra.fechaSiembra);
  if (fromZafra) return fromZafra;

  const ordered = [...eventos]
    .map((ev) => ({ ev, date: getEventDate(ev) }))
    .filter((x): x is { ev: Evento; date: Date } => !!x.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstSiembra = ordered.find(({ ev }) => getTipoBaseFromEvento(ev.tipo) === "siembra");
  if (firstSiembra) return firstSiembra.date;

  if (ordered.length > 0) return ordered[0].date;

  return new Date();
}

export function getHarvestEndDate(eventos: Evento[]): Date | null {
  return eventos.reduce<Date | null>((latest, evento) => {
    if (getTipoBaseFromEvento(evento.tipo) !== "cosecha") return latest;

    const eventDate = getEventDate(evento);
    if (!eventDate) return latest;
    if (!latest) return eventDate;

    return eventDate.getTime() > latest.getTime() ? eventDate : latest;
  }, null);
}

export function getCycleMetrics(zafra: Zafra, eventos: Evento[], fallbackEndDate: Date = new Date()) {
  const sowingDate = getSowingBaseDate(zafra, eventos);
  const harvestDate = getHarvestEndDate(eventos);
  const endDate = harvestDate || fallbackEndDate;
  const totalDays = Math.max(0, differenceInDays(endDate, sowingDate));

  return {
    sowingDate,
    harvestDate,
    endDate,
    totalDays,
    isClosed: Boolean(harvestDate),
  };
}

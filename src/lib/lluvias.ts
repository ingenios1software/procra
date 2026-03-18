import type { Parcela, RegistroLluviaSector } from "@/lib/types";

export type RegistroLluviaSectorDraft = Pick<
  RegistroLluviaSector,
  "zafraId" | "zafraNombre" | "fecha" | "sector" | "milimetros" | "observacion"
>;

export type LluviaDistribuidaParcelaZafra = {
  parcelaId: string;
  zafraId: string;
  sector: string;
  milimetros: number;
  registros: number;
  ultimaFecha?: Date | string;
};

export function normalizeSectorName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function sanitizeRegistroLluviaSectorDraft(
  data: RegistroLluviaSectorDraft
): RegistroLluviaSectorDraft {
  return {
    ...data,
    zafraNombre: String(data.zafraNombre ?? "").trim() || null,
    sector: String(data.sector ?? "").trim().replace(/\s+/g, " "),
    milimetros: Math.max(0, Number(data.milimetros) || 0),
    observacion: String(data.observacion ?? "").trim() || null,
  };
}

export function getSectoresDisponibles(parcelas: Parcela[]) {
  return [...new Set(parcelas.map((parcela) => String(parcela.sector ?? "").trim()).filter(Boolean))]
    .sort((first, second) =>
      first.localeCompare(second, "es", { sensitivity: "base", numeric: true })
    );
}

function getComparableTime(value?: Date | string) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function buildLluviaDistribuidaPorParcelaZafra(
  parcelas: Parcela[],
  registros: RegistroLluviaSector[]
) {
  const parcelasPorSector = new Map<string, Parcela[]>();

  parcelas.forEach((parcela) => {
    const sectorNormalizado = normalizeSectorName(parcela.sector);
    if (!sectorNormalizado) return;

    const existing = parcelasPorSector.get(sectorNormalizado) || [];
    existing.push(parcela);
    parcelasPorSector.set(sectorNormalizado, existing);
  });

  const resumen = new Map<string, LluviaDistribuidaParcelaZafra>();

  registros.forEach((registro) => {
    const zafraId = String(registro.zafraId ?? "").trim();
    const sectorNormalizado =
      normalizeSectorName(registro.sectorNormalizado) || normalizeSectorName(registro.sector);

    if (!zafraId || !sectorNormalizado) return;

    const parcelasDelSector = parcelasPorSector.get(sectorNormalizado) || [];
    if (parcelasDelSector.length === 0) return;

    parcelasDelSector.forEach((parcela) => {
      const key = `${parcela.id}__${zafraId}`;
      const existing = resumen.get(key);

      if (!existing) {
        resumen.set(key, {
          parcelaId: parcela.id,
          zafraId,
          sector: parcela.sector || registro.sector,
          milimetros: Number(registro.milimetros) || 0,
          registros: 1,
          ultimaFecha: registro.fecha,
        });
        return;
      }

      existing.milimetros += Number(registro.milimetros) || 0;
      existing.registros += 1;

      if (getComparableTime(registro.fecha) >= getComparableTime(existing.ultimaFecha)) {
        existing.ultimaFecha = registro.fecha;
      }
    });
  });

  return [...resumen.values()];
}

export function getLluviaAcumuladaParcelaZafra(
  parcelas: Parcela[],
  registros: RegistroLluviaSector[],
  parcelaId?: string | null,
  zafraId?: string | null
) {
  if (!parcelaId || !zafraId) return 0;

  const resumen = buildLluviaDistribuidaPorParcelaZafra(parcelas, registros).find(
    (item) => item.parcelaId === parcelaId && item.zafraId === zafraId
  );

  return resumen?.milimetros || 0;
}

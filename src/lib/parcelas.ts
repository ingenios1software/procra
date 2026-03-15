import type { Parcela } from "@/lib/types";

type ParcelaDraft = Omit<Parcela, "id" | "numeroItem">;

export function normalizeParcelaText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function sanitizeParcelaDraft(data: ParcelaDraft): ParcelaDraft {
  return {
    ...data,
    nombre: String(data.nombre ?? "").trim().replace(/\s+/g, " "),
    codigo: String(data.codigo ?? "").trim().replace(/\s+/g, " ").toUpperCase(),
    ubicacion: String(data.ubicacion ?? "").trim().replace(/\s+/g, " "),
    sector: String(data.sector ?? "").trim().replace(/\s+/g, " "),
  };
}

export function findDuplicateParcela(
  parcelas: Parcela[],
  data: ParcelaDraft,
  currentParcelaId?: string | null
) {
  const normalizedNombre = normalizeParcelaText(data.nombre);
  const normalizedCodigo = normalizeParcelaText(data.codigo);

  const duplicateName = parcelas.find(
    (parcela) =>
      parcela.id !== currentParcelaId &&
      normalizeParcelaText(parcela.nombre) === normalizedNombre
  );

  const duplicateCode = parcelas.find(
    (parcela) =>
      parcela.id !== currentParcelaId &&
      normalizeParcelaText(parcela.codigo) === normalizedCodigo
  );

  return { duplicateName, duplicateCode };
}

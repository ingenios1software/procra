import type { DnitCacheRecord, DnitTaxpayerSnapshot } from "@/lib/types";

export function getDnitPrimaryName(taxpayer?: DnitTaxpayerSnapshot | null): string {
  return taxpayer?.nombreComercial?.trim() || taxpayer?.razonSocial?.trim() || "";
}

export function formatDnitDocument(taxpayer?: Pick<DnitTaxpayerSnapshot, "documento" | "ruc" | "dv"> | null): string {
  if (!taxpayer) return "";
  if (taxpayer.documento?.trim()) return taxpayer.documento.trim();
  if (taxpayer.ruc?.trim() && taxpayer.dv?.trim()) {
    return `${taxpayer.ruc.trim()}-${taxpayer.dv.trim()}`;
  }
  return taxpayer.ruc?.trim() || "";
}

export function normalizeDnitSearchText(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function buildDnitCacheRecordId(taxpayer: Pick<DnitTaxpayerSnapshot, "ruc" | "dv" | "documento">): string {
  return formatDnitDocument(taxpayer) || `${taxpayer.ruc}-${taxpayer.dv}`;
}

export function buildDnitSearchText(
  taxpayer: Partial<
    Pick<DnitCacheRecord, "alias" | "notas" | "searchName" | "searchDocument" | "razonSocial" | "nombreComercial" | "rucAnterior">
  >
): string {
  return normalizeDnitSearchText(
    [
      taxpayer.alias,
      taxpayer.notas,
      taxpayer.searchName,
      taxpayer.searchDocument,
      taxpayer.razonSocial,
      taxpayer.nombreComercial,
      taxpayer.rucAnterior,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function buildDnitCacheRecord(taxpayer: DnitTaxpayerSnapshot): DnitCacheRecord {
  const searchName = getDnitPrimaryName(taxpayer) || taxpayer.razonSocial || taxpayer.documento;
  const searchDocument = formatDnitDocument(taxpayer);

  return {
    ...taxpayer,
    documento: searchDocument,
    searchName,
    searchDocument,
    searchText: buildDnitSearchText({
      searchName,
      searchDocument,
      razonSocial: taxpayer.razonSocial,
      nombreComercial: taxpayer.nombreComercial,
      rucAnterior: taxpayer.rucAnterior,
    }),
    actualizadoEn: new Date().toISOString(),
  };
}

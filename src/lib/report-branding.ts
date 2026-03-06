import type { EmpresaSaaS } from "@/lib/types";

export type ReportBranding = {
  logoSrc?: string;
  logoFallbackSrcList?: string[];
  companyName: string;
  legalName?: string;
  ruc?: string;
  address?: string;
  contact?: string;
  preparedBy?: string;
  approvedBy?: string;
};

export const defaultReportBranding: ReportBranding = {
  logoSrc: "/branding/ingeniosoft95-logo.png",
  logoFallbackSrcList: [
    "/branding/ingeniosoft95-logo.svg",
    "/branding/ingeniosoft95-logo.jpg",
    "/branding/logo.png",
    "/branding/logo.jpg",
    "/branding/logo.svg",
  ],
  companyName: "IngenioSoft95",
  legalName: "Sistema de Gestion Agricola",
  ruc: "RUC: -",
  address: "Direccion: -",
  contact: "Contacto: -",
  preparedBy: "Responsable RRHH",
  approvedBy: "Administracion",
};

function joinValues(values: Array<string | null | undefined>, separator: string) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}

export function getReportBrandingFromEmpresa(empresa?: EmpresaSaaS | null): ReportBranding {
  if (!empresa) return defaultReportBranding;

  const legalName = joinValues(
    [empresa.perfil?.razonSocial || empresa.nombre, empresa.perfil?.rubro ? `Rubro: ${empresa.perfil.rubro}` : null],
    " | "
  );
  const address = joinValues(
    [empresa.perfil?.direccion, empresa.perfil?.ciudad, empresa.perfil?.pais],
    ", "
  );
  const contact = joinValues(
    [empresa.perfil?.contacto, empresa.perfil?.telefono, empresa.perfil?.email],
    " | "
  );

  return {
    ...defaultReportBranding,
    companyName: empresa.nombre?.trim() || defaultReportBranding.companyName,
    legalName: legalName || defaultReportBranding.legalName,
    ruc: empresa.perfil?.ruc?.trim() ? `RUC: ${empresa.perfil.ruc.trim()}` : defaultReportBranding.ruc,
    address: address ? `Direccion: ${address}` : defaultReportBranding.address,
    contact: contact ? `Contacto: ${contact}` : defaultReportBranding.contact,
    logoSrc: empresa.branding?.logoSrc?.trim() || defaultReportBranding.logoSrc,
    preparedBy: empresa.branding?.preparedBy?.trim() || defaultReportBranding.preparedBy,
    approvedBy: empresa.branding?.approvedBy?.trim() || defaultReportBranding.approvedBy,
  };
}

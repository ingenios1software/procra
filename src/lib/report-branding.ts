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

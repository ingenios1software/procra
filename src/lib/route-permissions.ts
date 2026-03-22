import type { Permisos } from "@/lib/types";

function normalizePath(pathname: string): string {
  const basePath = (pathname || "/").split("?")[0].split("#")[0].trim();
  const lower = basePath.toLowerCase();
  if (lower === "") return "/";
  if (lower.length > 1 && lower.endsWith("/")) return lower.slice(0, -1);
  return lower;
}

export function getPermissionForPath(pathname: string): keyof Permisos | null {
  const path = normalizePath(pathname);

  if (path === "/" || path === "/dashboard" || path.startsWith("/acceso-denegado")) return null;
  if (path.startsWith("/dashboard/monitoreo")) return "monitoreos";
  if (path.startsWith("/dashboard/general")) return "administracion";

  if (path.startsWith("/parcelas")) return "maestros";
  if (path.startsWith("/cultivos")) return "maestros";
  if (path.startsWith("/zafras")) return "maestros";

  if (path.startsWith("/eventos")) return "eventos";
  if (path.startsWith("/stock")) return "stock";
  if (path.startsWith("/maquinaria")) return "eventos";

  if (path.startsWith("/agronomia")) return "agronomia";

  if (path.startsWith("/comercial/ventas")) return "ventas";
  if (path.startsWith("/comercial/compras")) return "compras";
  if (path.startsWith("/comercial/clientes")) return "ventas";
  if (path.startsWith("/comercial/proveedores")) return "ventas";

  if (path.startsWith("/finanzas")) return "finanzas";
  if (path.startsWith("/contabilidad")) return "contabilidad";
  if (path.startsWith("/rrhh")) return "rrhh";
  if (path.startsWith("/maestros")) return "maestros";
  if (path.startsWith("/usuarios")) return "usuarios";
  if (path.startsWith("/roles")) return "roles";

  if (
    path.startsWith("/auditoria") ||
    path.startsWith("/admin") ||
    path.startsWith("/guia-del-sistema") ||
    path.startsWith("/configuracion") ||
    path.startsWith("/acerca-de")
  ) {
    return "administracion";
  }

  return null;
}

export function getModuloLabelForPermission(permission: keyof Permisos | null): string {
  if (permission === "compras") return "Compras";
  if (permission === "stock") return "Stock";
  if (permission === "eventos") return "Eventos";
  if (permission === "monitoreos") return "Monitoreos";
  if (permission === "ventas") return "Ventas";
  if (permission === "contabilidad") return "Contabilidad";
  if (permission === "rrhh") return "RRHH";
  if (permission === "finanzas") return "Finanzas";
  if (permission === "agronomia") return "Agronomia";
  if (permission === "maestros") return "Maestros";
  if (permission === "usuarios") return "Usuarios";
  if (permission === "roles") return "Roles";
  if (permission === "administracion") return "Administracion";
  return "General";
}

export function canAccessPathByPermisos(
  pathname: string,
  permisos: Permisos,
  role?: string | null
): boolean {
  const permission = getPermissionForPath(pathname);
  if (!permission) return true;
  return Boolean(permisos[permission]);
}

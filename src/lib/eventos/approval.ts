import type { Permisos, Usuario } from "@/lib/types";

type ApprovalContext = {
  permisos?: Partial<Permisos> | null;
  role?: string | null;
  usuarioApp?: Pick<Usuario, "rolId" | "rolNombre"> | null;
};

const READ_ONLY_ROLES = new Set(["consulta", "gerente", "auditor"]);
const APPROVER_ROLES = new Set([
  "admin",
  "supervisor",
  "capataz",
  "tecnico",
  "tecnicocampo",
  "operador",
]);

function normalizeRoleKey(value?: string | null): string {
  if (!value) return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function canApproveEvento({ permisos, role, usuarioApp }: ApprovalContext): boolean {
  const roleKeys = Array.from(
    new Set(
      [role, usuarioApp?.rolNombre, usuarioApp?.rolId]
        .map((value) => normalizeRoleKey(value))
        .filter(Boolean)
    )
  );

  if (roleKeys.some((roleKey) => READ_ONLY_ROLES.has(roleKey))) {
    return false;
  }

  if (permisos?.administracion) {
    return true;
  }

  if (roleKeys.some((roleKey) => APPROVER_ROLES.has(roleKey))) {
    return true;
  }

  return Boolean(permisos?.eventos && roleKeys.length > 0);
}

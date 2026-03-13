import type { Empleado } from "@/lib/types";

type EmpleadoBase = Pick<Empleado, "id" | "codigo" | "documento" | "nombre" | "apellido">;

function cleanValue(value?: string | null): string {
  return String(value ?? "").trim();
}

export function getEmpleadoCodigo(empleado?: Partial<EmpleadoBase> | null): string {
  if (!empleado) return "N/A";

  const codigo = cleanValue(empleado.codigo);
  if (codigo) return codigo;

  const documento = cleanValue(empleado.documento);
  if (documento) return documento;

  const id = cleanValue(empleado.id);
  return id || "N/A";
}

export function getEmpleadoNombreCompleto(
  empleado?: Partial<EmpleadoBase> | null,
  options?: { invertido?: boolean }
): string {
  if (!empleado) return "";

  const nombre = cleanValue(empleado.nombre);
  const apellido = cleanValue(empleado.apellido);

  if (options?.invertido) {
    return [apellido, nombre].filter(Boolean).join(", ").trim();
  }

  return [nombre, apellido].filter(Boolean).join(" ").trim();
}

export function getEmpleadoEtiqueta(
  empleado?: Partial<EmpleadoBase> | null,
  options?: { invertido?: boolean }
): string {
  const codigo = getEmpleadoCodigo(empleado);
  const nombre = getEmpleadoNombreCompleto(empleado, options);
  return nombre ? `${codigo} - ${nombre}` : codigo;
}

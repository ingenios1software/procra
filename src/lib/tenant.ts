import { collection, doc, serverTimestamp, type Firestore, type QueryConstraint, query } from "firebase/firestore";
import type { EmpresaSaaS, Permisos, Rol } from "@/lib/types";

export const DEFAULT_COMPANY_MODULES: Permisos = {
  compras: true,
  stock: true,
  eventos: true,
  monitoreos: true,
  ventas: true,
  contabilidad: true,
  rrhh: true,
  finanzas: true,
  agronomia: true,
  maestros: true,
  usuarios: true,
  roles: true,
  administracion: true,
};

export type TenantRoleSeed = Omit<Rol, "id"> & { id: string };

export function buildTenantRoleSeeds(): TenantRoleSeed[] {
  return [
    {
      id: "admin",
      nombre: "admin",
      descripcion: "Administrador de la empresa cliente.",
      permisos: { ...DEFAULT_COMPANY_MODULES },
      soloLectura: false,
      esSistema: true,
    },
    {
      id: "tecnico",
      nombre: "tecnico",
      descripcion: "Operacion de campo con acceso amplio a los modulos productivos.",
      permisos: {
        compras: true,
        stock: true,
        eventos: true,
        monitoreos: true,
        ventas: true,
        contabilidad: false,
        rrhh: false,
        finanzas: false,
        agronomia: true,
        maestros: true,
        usuarios: false,
        roles: false,
        administracion: false,
      },
      soloLectura: false,
      esSistema: true,
    },
    {
      id: "operador",
      nombre: "operador",
      descripcion: "Carga y consulta operativa sin administracion general.",
      permisos: {
        compras: true,
        stock: true,
        eventos: true,
        monitoreos: true,
        ventas: true,
        contabilidad: false,
        rrhh: false,
        finanzas: true,
        agronomia: true,
        maestros: true,
        usuarios: false,
        roles: false,
        administracion: false,
      },
      soloLectura: false,
      esSistema: true,
    },
    {
      id: "consulta",
      nombre: "consulta",
      descripcion: "Consulta general sin capacidad de modificacion.",
      permisos: {
        ...DEFAULT_COMPANY_MODULES,
        usuarios: false,
        roles: false,
      },
      soloLectura: true,
      esSistema: true,
    },
  ];
}

export function buildEmpresaBasePayload(params: {
  nombre: string;
  contacto?: string | null;
  email?: string | null;
  pais?: string | null;
  plan?: EmpresaSaaS["suscripcion"]["plan"];
  maxUsuarios?: number | null;
  modulos?: Partial<Permisos>;
}): Omit<EmpresaSaaS, "id"> & Record<string, unknown> {
  const now = new Date();
  const demoEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  return {
    nombre: params.nombre.trim() || "Mi Empresa",
    activo: true,
    perfil: {
      contacto: params.contacto?.trim() || undefined,
      email: params.email?.trim().toLowerCase() || undefined,
      pais: params.pais?.trim() || "Paraguay",
    },
    branding: {
      preparedBy: "Responsable",
      approvedBy: "Administracion",
    },
    modulos: {
      ...DEFAULT_COMPANY_MODULES,
      ...(params.modulos || {}),
    },
    demo: {
      habilitado: true,
      inicio: now.toISOString(),
      fin: demoEnd.toISOString(),
    },
    suscripcion: {
      estado: "trial",
      plan: params.plan || "demo",
      modeloCobro: "por_empresa",
      moneda: "USD",
      montoMensual: 0,
      maxUsuarios: params.maxUsuarios ?? 3,
      proximoCobro: undefined,
    },
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };
}

export function tenantCollection<TCollection extends string>(
  firestore: Firestore,
  empresaId: string,
  collectionName: TCollection
) {
  return collection(firestore, "empresas", empresaId, collectionName);
}

export function tenantDoc<TCollection extends string>(
  firestore: Firestore,
  empresaId: string,
  collectionName: TCollection,
  documentId: string
) {
  return doc(firestore, "empresas", empresaId, collectionName, documentId);
}

export function tenantQuery<TCollection extends string>(
  firestore: Firestore,
  empresaId: string,
  collectionName: TCollection,
  ...constraints: QueryConstraint[]
) {
  return query(tenantCollection(firestore, empresaId, collectionName), ...constraints);
}

export const LEGACY_TENANT_COLLECTIONS = [
  "roles",
  "parcelas",
  "cultivos",
  "zafras",
  "eventos",
  "insumos",
  "lotesInsumos",
  "MovimientosStock",
  "maquinaria",
  "plagas",
  "tiposEvento",
  "etapasCultivo",
  "depositos",
  "monedas",
  "planDeCuentas",
  "cuentasCajaBanco",
  "centrosDeCosto",
  "clientes",
  "proveedores",
  "comprasNormal",
  "ventas",
  "cuentasPorCobrar",
  "cuentasPorPagar",
  "cobrosCxc",
  "pagosCxp",
  "notasCreditoFinancieras",
  "recibosCobro",
  "movimientosTesoreria",
  "asientosDiario",
  "stockGranos",
  "rendimientosAgricolas",
  "lluviasSector",
  "auditoriaAsistente",
  "costos",
  "empleados",
  "controlHorario",
  "tiposTrabajo",
  "asistencias",
  "pagosNominaHoras",
  "recibosPagoEmpleado",
] as const;

export type LegacyTenantCollection = (typeof LEGACY_TENANT_COLLECTIONS)[number];

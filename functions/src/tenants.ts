import { randomUUID } from "crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const adminAuth = getAuth();

const PLATFORM_ADMIN_EMAILS = new Set([
  "admin@crapro95.com",
  "ricardo.ortellado@outlook.com",
]);

const DEFAULT_COMPANY_MODULES = {
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
  administracion: true,
};

const DEFAULT_TENANT_ROLES = [
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
      administracion: false,
    },
    soloLectura: false,
    esSistema: true,
  },
  {
    id: "consulta",
    nombre: "consulta",
    descripcion: "Consulta general sin capacidad de modificacion.",
    permisos: { ...DEFAULT_COMPANY_MODULES },
    soloLectura: true,
    esSistema: true,
  },
];

const LEGACY_TENANT_COLLECTIONS = [
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
  "recibosCobro",
  "movimientosTesoreria",
  "asientosDiario",
  "stockGranos",
  "rendimientosAgricolas",
  "auditoriaAsistente",
  "costos",
  "empleados",
  "controlHorario",
  "tiposTrabajo",
  "asistencias",
  "pagosNominaHoras",
  "recibosPagoEmpleado",
];

type AppUser = {
  empresaId?: string;
  rolId?: string;
  rolNombre?: string;
  esSuperAdmin?: boolean;
  activo?: boolean;
  email?: string;
  nombre?: string;
};

type CallableAuthRequest = {
  auth?: {
    uid?: string;
    token?: {
      email?: string;
    };
  };
  data?: Record<string, unknown>;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoleKey(value: unknown): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function getAuthErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

function toAuthHttpsError(error: unknown, fallbackMessage: string): HttpsError {
  const code = getAuthErrorCode(error);

  if (code === "auth/email-already-exists") {
    return new HttpsError("already-exists", "Ya existe un usuario con ese correo electronico.");
  }
  if (code === "auth/invalid-email") {
    return new HttpsError("invalid-argument", "El correo electronico no es valido.");
  }
  if (code === "auth/invalid-password") {
    return new HttpsError("invalid-argument", "La clave indicada no es valida.");
  }

  return new HttpsError("internal", fallbackMessage);
}

async function assertEmailAvailable(email: string): Promise<void> {
  try {
    await adminAuth.getUserByEmail(email);
    throw new HttpsError("already-exists", "Ya existe un usuario con ese correo electronico.");
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    if (getAuthErrorCode(error) === "auth/user-not-found") {
      return;
    }

    throw toAuthHttpsError(error, "No se pudo validar el correo electronico indicado.");
  }
}

async function getRequesterProfile(uid: string): Promise<AppUser | null> {
  const snap = await db.doc(`usuarios/${uid}`).get();
  return snap.exists ? (snap.data() as AppUser) : null;
}

function isPlatformAdminRequest(request: CallableAuthRequest, profile: AppUser | null): boolean {
  const email = normalizeEmail(request.auth?.token?.email);
  return PLATFORM_ADMIN_EMAILS.has(email) || Boolean(profile?.esSuperAdmin);
}

async function tenantRoleAllowsAdministration(profile: AppUser, empresaId: string): Promise<boolean> {
  const rolId = normalizeText(profile.rolId);
  if (!rolId) return false;

  const roleSnap = await db.doc(`empresas/${empresaId}/roles/${rolId}`).get();
  return roleSnap.exists && roleSnap.get("permisos.administracion") === true;
}

async function canManageCompany(profile: AppUser, empresaId: string): Promise<boolean> {
  if (!profile.activo || normalizeText(profile.empresaId) !== empresaId) {
    return false;
  }

  const isTenantAdmin =
    normalizeRoleKey(profile.rolId) === "admin" || normalizeRoleKey(profile.rolNombre) === "admin";
  if (isTenantAdmin) {
    return true;
  }

  return tenantRoleAllowsAdministration(profile, empresaId);
}

function assertAuthenticated(request: CallableAuthRequest): { uid: string } {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }
  return { uid };
}

async function assertCompanyAdminAccess(
  request: CallableAuthRequest,
  empresaId?: string | null
): Promise<{ uid: string; profile: AppUser; empresaId: string; isPlatformAdmin: boolean }> {
  const { uid } = assertAuthenticated(request);
  const profile = await getRequesterProfile(uid);
  if (!profile) {
    throw new HttpsError("permission-denied", "El usuario autenticado no tiene perfil en la aplicacion.");
  }

  const isPlatformAdmin = isPlatformAdminRequest(request, profile);
  const resolvedEmpresaId = normalizeText(empresaId) || normalizeText(profile.empresaId);
  if (!resolvedEmpresaId) {
    throw new HttpsError("failed-precondition", "El usuario no tiene empresa asignada.");
  }

  if (isPlatformAdmin) {
    return { uid, profile, empresaId: resolvedEmpresaId, isPlatformAdmin };
  }

  if (!(await canManageCompany(profile, resolvedEmpresaId))) {
    throw new HttpsError(
      "permission-denied",
      "Solo los usuarios con permisos de administracion de la empresa pueden realizar esta accion."
    );
  }

  return { uid, profile, empresaId: resolvedEmpresaId, isPlatformAdmin };
}

async function seedTenantRoles(empresaId: string): Promise<void> {
  const batch = db.batch();
  DEFAULT_TENANT_ROLES.forEach((role) => {
    batch.set(db.doc(`empresas/${empresaId}/roles/${role.id}`), role, { merge: true });
  });
  await batch.commit();
}

async function seedTenantMasters(empresaId: string): Promise<void> {
  const batch = db.batch();
  const plan = [
    { id: "caja_general", codigo: "1.1.1", nombre: "Caja General", tipo: "activo", naturaleza: "deudora" },
    { id: "bancos", codigo: "1.1.2", nombre: "Bancos", tipo: "activo", naturaleza: "deudora" },
    { id: "clientes", codigo: "1.1.3", nombre: "Clientes", tipo: "activo", naturaleza: "deudora" },
    { id: "inventario", codigo: "1.1.4", nombre: "Inventario", tipo: "activo", naturaleza: "deudora" },
    { id: "proveedores", codigo: "2.1.1", nombre: "Proveedores", tipo: "pasivo", naturaleza: "acreedora" },
    { id: "ventas", codigo: "4.1.1", nombre: "Ventas", tipo: "ingreso", naturaleza: "acreedora" },
    { id: "iva_credito", codigo: "1.1.5", nombre: "IVA Credito Fiscal", tipo: "activo", naturaleza: "deudora" },
    { id: "iva_debito", codigo: "2.1.2", nombre: "IVA Debito Fiscal", tipo: "pasivo", naturaleza: "acreedora" },
    { id: "cmv", codigo: "5.1.1", nombre: "Costo de Mercaderias Vendidas", tipo: "costo", naturaleza: "deudora" },
  ];

  plan.forEach((cuenta) => {
    batch.set(db.doc(`empresas/${empresaId}/planDeCuentas/${cuenta.id}`), cuenta, { merge: true });
  });

  batch.set(
    db.doc(`empresas/${empresaId}/monedas/PYG`),
    { codigo: "PYG", descripcion: "Guarani Paraguayo", tasaCambio: 1, esMonedaBase: true },
    { merge: true }
  );
  batch.set(
    db.doc(`empresas/${empresaId}/monedas/USD`),
    { codigo: "USD", descripcion: "Dolar Estadounidense", tasaCambio: 1, esMonedaBase: false },
    { merge: true }
  );
  batch.set(
    db.doc(`empresas/${empresaId}/depositos/deposito_principal`),
    { nombre: "Deposito Principal", descripcion: "Deposito inicial del cliente.", activo: true },
    { merge: true }
  );
  batch.set(
    db.doc(`empresas/${empresaId}/cultivos/cultivo_inicial`),
    { nombre: "Cultivo Inicial", descripcion: "Cultivo base para comenzar a operar." },
    { merge: true }
  );
  batch.set(
    db.doc(`empresas/${empresaId}/zafras/zafra_inicial`),
    {
      nombre: "Zafra Inicial",
      fechaInicio: new Date().toISOString(),
      estado: "en curso",
      cultivoId: "cultivo_inicial",
    },
    { merge: true }
  );
  batch.set(
    db.doc(`empresas/${empresaId}/cuentasCajaBanco/caja_principal_pyg`),
    {
      nombre: "Caja Principal Gs",
      tipo: "CAJA",
      monedaId: "PYG",
      cuentaContableId: "caja_general",
      activo: true,
    },
    { merge: true }
  );
  await batch.commit();
}

function buildEmpresaPayload(data: Record<string, unknown>) {
  const now = new Date();
  const demoEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  const nombre = normalizeText(data.nombreEmpresa) || "Mi Empresa";
  const plan = normalizeText(data.plan) || "demo";
  const maxUsuarios = parsePositiveNumber(data.maxUsuarios) ?? 3;

  return {
    nombre,
    activo: true,
    perfil: {
      contacto: normalizeText(data.adminNombre) || undefined,
      email: normalizeEmail(data.adminEmail) || undefined,
      pais: normalizeText(data.pais) || "Paraguay",
    },
    branding: {
      preparedBy: "Responsable",
      approvedBy: "Administracion",
    },
    modulos: {
      ...DEFAULT_COMPANY_MODULES,
      ...(typeof data.modulos === "object" && data.modulos ? (data.modulos as Record<string, boolean>) : {}),
    },
    demo: {
      habilitado: true,
      inicio: now.toISOString(),
      fin: demoEnd.toISOString(),
    },
    suscripcion: {
      estado: "trial",
      plan,
      modeloCobro: "por_empresa",
      moneda: "USD",
      montoMensual: 0,
      maxUsuarios,
      proximoCobro: null,
    },
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp(),
  };
}

async function countActiveUsers(empresaId: string): Promise<number> {
  const snap = await db
    .collection("usuarios")
    .where("empresaId", "==", empresaId)
    .where("activo", "==", true)
    .get();
  return snap.size;
}

export const createTenantCompany = onCall(async (request) => {
  const { uid } = assertAuthenticated(request);
  const profile = await getRequesterProfile(uid);
  if (!isPlatformAdminRequest(request, profile)) {
    throw new HttpsError("permission-denied", "Solo un administrador de plataforma puede crear empresas.");
  }

  const adminEmail = normalizeEmail(request.data?.adminEmail);
  const adminPassword = normalizeText(request.data?.adminPassword);
  const adminNombre = normalizeText(request.data?.adminNombre);
  const nombreEmpresa = normalizeText(request.data?.nombreEmpresa);

  if (!nombreEmpresa) {
    throw new HttpsError("invalid-argument", "Debes indicar el nombre de la empresa.");
  }
  if (!adminNombre) {
    throw new HttpsError("invalid-argument", "Debes indicar el nombre del usuario administrador.");
  }
  if (!adminEmail) {
    throw new HttpsError("invalid-argument", "Debes indicar el email del administrador.");
  }
  if (adminPassword.length < 6) {
    throw new HttpsError("invalid-argument", "La clave del administrador debe tener al menos 6 caracteres.");
  }

  await assertEmailAvailable(adminEmail);

  const empresaId = `empresa_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  let createdUser;
  try {
    createdUser = await adminAuth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminNombre,
    });
  } catch (error) {
    throw toAuthHttpsError(error, "No se pudo crear el usuario administrador inicial.");
  }

  const empresaPayload = buildEmpresaPayload({
    ...request.data,
    adminNombre,
    adminEmail,
    nombreEmpresa,
  });

  const batch = db.batch();
  batch.set(db.doc(`empresas/${empresaId}`), empresaPayload, { merge: true });
  batch.set(
    db.doc(`usuarios/${createdUser.uid}`),
    {
      nombre: adminNombre,
      email: adminEmail,
      rolId: "admin",
      rolNombre: "admin",
      empresaId,
      activo: true,
      esSuperAdmin: false,
      creadoEn: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  await seedTenantRoles(empresaId);
  await seedTenantMasters(empresaId);

  return {
    ok: true,
    empresaId,
    adminUid: createdUser.uid,
    adminEmail,
  };
});

export const createTenantUser = onCall(async (request) => {
  const access = await assertCompanyAdminAccess(request, request.data?.empresaId as string | undefined);

  const nombre = normalizeText(request.data?.nombre);
  const email = normalizeEmail(request.data?.email);
  const password = normalizeText(request.data?.password);
  const rolId = normalizeText(request.data?.rolId);
  const activo = request.data?.activo !== false;

  if (!nombre) throw new HttpsError("invalid-argument", "Debes indicar el nombre del usuario.");
  if (!email) throw new HttpsError("invalid-argument", "Debes indicar el email del usuario.");
  if (!rolId) throw new HttpsError("invalid-argument", "Debes seleccionar un rol.");
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "La clave debe tener al menos 6 caracteres.");
  }

  const empresaSnap = await db.doc(`empresas/${access.empresaId}`).get();
  if (!empresaSnap.exists) {
    throw new HttpsError("not-found", "La empresa indicada no existe.");
  }

  const maxUsuarios = parsePositiveNumber(empresaSnap.get("suscripcion.maxUsuarios"));
  if (activo && maxUsuarios !== null) {
    const activeUsers = await countActiveUsers(access.empresaId);
    if (activeUsers >= maxUsuarios) {
      throw new HttpsError(
        "failed-precondition",
        `La empresa ya alcanzo su limite de ${maxUsuarios} usuarios activos para el plan actual.`
      );
    }
  }

  const roleSnap = await db.doc(`empresas/${access.empresaId}/roles/${rolId}`).get();
  if (!roleSnap.exists) {
    throw new HttpsError("not-found", "El rol seleccionado no existe para esta empresa.");
  }
  const roleName = normalizeText(roleSnap.get("nombre")) || rolId;

  await assertEmailAvailable(email);

  let createdUser;
  try {
    createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
      disabled: !activo,
    });
  } catch (error) {
    throw toAuthHttpsError(error, "No se pudo crear el usuario indicado.");
  }

  await db.doc(`usuarios/${createdUser.uid}`).set(
    {
      nombre,
      email,
      rolId,
      rolNombre: roleName,
      empresaId: access.empresaId,
      activo,
      esSuperAdmin: false,
      creadoEn: FieldValue.serverTimestamp(),
      creadoPor: access.uid,
    },
    { merge: true }
  );

  return {
    ok: true,
    uid: createdUser.uid,
    empresaId: access.empresaId,
  };
});

export const migrateLegacyDataToTenant = onCall(async (request) => {
  const access = await assertCompanyAdminAccess(request, request.data?.empresaId as string | undefined);
  const collections: string[] =
    Array.isArray(request.data?.collections) && request.data?.collections.length > 0
      ? request.data.collections.filter((value: unknown): value is string => typeof value === "string")
      : LEGACY_TENANT_COLLECTIONS;

  const validCollections = collections.filter((name: string) => LEGACY_TENANT_COLLECTIONS.includes(name));
  if (validCollections.length === 0) {
    throw new HttpsError("invalid-argument", "No se indicaron colecciones validas para migrar.");
  }

  let migratedDocs = 0;
  for (const collectionName of validCollections) {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) continue;

    let writesInBatch = 0;
    let batch = db.batch();

    for (const legacyDoc of snap.docs) {
      const sourceData = legacyDoc.data() as DocumentData;
      const targetRef = db.doc(`empresas/${access.empresaId}/${collectionName}/${legacyDoc.id}`);
      batch.set(
        targetRef,
        {
          ...sourceData,
          empresaId: access.empresaId,
          migradoDesdeLegacyEn: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      writesInBatch += 1;
      migratedDocs += 1;

      if (writesInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        writesInBatch = 0;
      }
    }

    if (writesInBatch > 0) {
      await batch.commit();
    }
  }

  await seedTenantRoles(access.empresaId);
  await seedTenantMasters(access.empresaId);

  return {
    ok: true,
    empresaId: access.empresaId,
    migratedDocs,
    collections: validCollections,
  };
});

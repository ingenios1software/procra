import type { Permisos } from "@/lib/types";

export type GuideItem = {
  title: string;
  description: string;
};

export type GuideModule = {
  title: string;
  permission: keyof Permisos;
  summary: string;
  capabilities: string[];
  routes: string[];
};

export type GuideFlow = {
  title: string;
  steps: string[];
};

export const systemGuideMeta = {
  documentTitle: "Guia del Sistema",
  systemName: "CRApro95",
  version: "0.1",
  status: "Guia viva",
  summary: [
    "CRApro95 es una plataforma de gestion agropecuaria pensada para centralizar la operacion del campo, la administracion interna y el analisis del negocio en un mismo entorno.",
    "El sistema organiza la informacion por empresa, habilita modulos segun suscripcion y permisos, y conecta procesos productivos, comerciales, financieros, contables y de recursos humanos.",
  ],
  objectives: [
    "Unificar datos operativos y administrativos en una sola plataforma.",
    "Dar trazabilidad a parcelas, zafras, eventos, compras, ventas y movimientos de stock.",
    "Ordenar accesos por rol, modulo y estado comercial de cada empresa.",
    "Facilitar reportes, analisis y exportacion de informacion para seguimiento y toma de decisiones.",
  ],
  audiences: [
    "Direccion o propietarios interesados en el alcance de la plataforma.",
    "Administradores responsables de configurar empresas, usuarios y permisos.",
    "Equipos operativos que registran informacion del campo, compras, ventas y RRHH.",
    "Interesados externos que necesiten una vista institucional del sistema.",
  ],
  principles: [
    "Gestion integrada",
    "Trazabilidad operativa",
    "Seguridad por permisos",
    "Escalabilidad multiempresa",
    "Evolucion continua",
  ],
};

export const systemGuideHighlights: GuideItem[] = [
  {
    title: "Cobertura integral",
    description:
      "La plataforma cubre ciclo productivo, comercial, finanzas, contabilidad, stock, maquinaria, RRHH y administracion.",
  },
  {
    title: "Arquitectura multiempresa",
    description:
      "Los datos pueden aislarse por empresa, con modulos habilitados segun plan SaaS y control de acceso por tenant.",
  },
  {
    title: "Documento compartible",
    description:
      "La misma guia se puede consultar dentro del sistema y exportar a PDF para presentacion o seguimiento.",
  },
];

export const systemGuideArchitecture: GuideItem[] = [
  {
    title: "Frontend web",
    description:
      "Aplicacion construida con Next.js 14, React 18, App Router, Tailwind CSS y componentes UI basados en Radix.",
  },
  {
    title: "Backend y datos",
    description:
      "Firebase aporta autenticacion, Firestore para persistencia y Cloud Functions para procesos protegidos e integraciones.",
  },
  {
    title: "Modelo multiempresa",
    description:
      "La aplicacion trabaja con empresas, roles y colecciones por tenant para separar informacion y facilitar escalabilidad comercial.",
  },
  {
    title: "Reportes y distribucion",
    description:
      "Varias pantallas permiten imprimir, exportar PDF y compartir contenido, lo que facilita uso interno y presentaciones.",
  },
  {
    title: "PWA y operacion web",
    description:
      "El proyecto incluye manifiesto web y service worker para una base progresiva de instalacion y experiencia tipo app.",
  },
  {
    title: "Evolucion guiada por negocio",
    description:
      "La plataforma esta organizada para crecer por modulos, manteniendo una base comun de autenticacion, permisos y datos maestros.",
  },
];

export const systemGuideAccessModel: GuideItem[] = [
  {
    title: "Autenticacion y perfil",
    description:
      "El acceso se realiza mediante inicio de sesion y perfil de usuario. Cada usuario se vincula a un rol y, cuando corresponde, a una empresa activa.",
  },
  {
    title: "Permisos funcionales",
    description:
      "Los modulos se habilitan por permisos puntuales: compras, stock, eventos, monitoreos, ventas, contabilidad, RRHH, finanzas, agronomia, maestros, usuarios, roles y administracion.",
  },
  {
    title: "Gates comerciales",
    description:
      "El acceso final depende tambien del estado comercial de la empresa y de los modulos contratados en el esquema SaaS.",
  },
  {
    title: "Administracion segura",
    description:
      "Las funciones mas sensibles, como usuarios, roles, auditoria, configuracion y herramientas internas, quedan restringidas a perfiles con permisos elevados.",
  },
];

export const systemGuideModules: GuideModule[] = [
  {
    title: "Gestion y base productiva",
    permission: "maestros",
    summary:
      "Define la estructura productiva principal del negocio agropecuario y sirve como base para el resto de los modulos.",
    capabilities: [
      "Alta y mantenimiento de parcelas con superficie, estado, ubicacion y reportes asociados.",
      "Catalogo de cultivos y organizacion de zafras o campanas.",
      "Reportes por parcela y zafra para seguimiento consolidado.",
    ],
    routes: ["/parcelas", "/cultivos", "/zafras", "/parcelas/[id]", "/zafras/[id]"],
  },
  {
    title: "Operaciones de campo",
    permission: "eventos",
    summary:
      "Centraliza el registro operativo del campo, la trazabilidad de eventos y la relacion con stock, monitoreo y maquinaria.",
    capabilities: [
      "Registro de monitoreos, eventos y actividades por parcela, cultivo y zafra.",
      "Control de stock de insumos, lotes y movimientos asociados a compras, eventos y ajustes.",
      "Gestion de maquinaria y soporte al seguimiento de horas y servicios en campo.",
    ],
    routes: ["/dashboard/monitoreo", "/eventos", "/stock", "/stock/insumos/[insumoId]", "/maquinaria"],
  },
  {
    title: "Agronomia",
    permission: "agronomia",
    summary:
      "Proporciona herramientas tecnicas para seguimiento agronomico, costos del cultivo y catalogos especializados.",
    capabilities: [
      "Panel agronomico con indicadores y visualizacion del estado operativo.",
      "Informe de costos por parcela y zafra para analisis tecnico-economico.",
      "Gestion de plagas y etapas fenologicas del cultivo.",
    ],
    routes: ["/agronomia/panel", "/agronomia/informe-costos", "/agronomia/plagas", "/agronomia/etapas-cultivo"],
  },
  {
    title: "Comercial y facturas",
    permission: "ventas",
    summary:
      "Ordena relaciones con clientes y proveedores, y estructura el circuito de compras y ventas del negocio.",
    capabilities: [
      "Gestion comercial de ventas, clientes y proveedores.",
      "Consulta y registro de facturas de compra de insumos, productos y servicios.",
      "Base documental para integracion con stock, cuentas por cobrar y cuentas por pagar.",
    ],
    routes: ["/comercial/ventas", "/comercial/compras", "/comercial/clientes", "/comercial/proveedores"],
  },
  {
    title: "Finanzas",
    permission: "finanzas",
    summary:
      "Consolida la gestion financiera de la empresa a partir de cuentas, movimientos de caja y analisis economico.",
    capabilities: [
      "Dashboard financiero para seguimiento de ingresos, egresos y rentabilidad.",
      "Administracion de cuentas por cobrar, cuentas por pagar y tesoreria.",
      "Analisis de costos operativos y rentabilidad por cultivo o parcela.",
    ],
    routes: [
      "/finanzas/dashboard",
      "/finanzas/cuentas-cobrar",
      "/finanzas/cuentas-pagar",
      "/finanzas/tesoreria",
      "/finanzas/costos",
      "/finanzas/rentabilidad",
    ],
  },
  {
    title: "Contabilidad",
    permission: "contabilidad",
    summary:
      "Aporta estructura contable para ordenar cuentas, asientos y reportes financieros con criterio formal.",
    capabilities: [
      "Mantenimiento del plan de cuentas y centros de costo.",
      "Consulta del libro diario y libro mayor con filtros por cuenta y zafra.",
      "Balance por zafra o consolidado, alineado con la informacion operativa y financiera.",
    ],
    routes: [
      "/contabilidad/plan-de-cuentas",
      "/contabilidad/centros-de-costo",
      "/contabilidad/diario",
      "/contabilidad/mayor",
      "/contabilidad/balance",
    ],
  },
  {
    title: "Recursos humanos",
    permission: "rrhh",
    summary:
      "Gestiona personal, asistencias, control horario y procesos de liquidacion vinculados a la operacion diaria.",
    capabilities: [
      "Alta y administracion de empleados.",
      "Registro de asistencias y control horario con soporte de importacion biometrica.",
      "Liquidacion de jornales por horas con generacion de pagos, recibos y trazabilidad operativa.",
    ],
    routes: ["/rrhh/empleados", "/rrhh/asistencias", "/rrhh/control-horario", "/rrhh/liquidacion"],
  },
  {
    title: "Maestros transversales",
    permission: "maestros",
    summary:
      "Reune catalogos y configuraciones de base que sostienen varios procesos del sistema.",
    capabilities: [
      "Gestion de depositos, monedas y cuentas de caja o banco.",
      "Definicion de tipos de evento y otras tablas de soporte.",
      "Base comun para operaciones, finanzas, contabilidad y reportes.",
    ],
    routes: ["/maestros/depositos", "/maestros/monedas", "/maestros/tipos-evento", "/maestros/cuentas-caja-banco"],
  },
  {
    title: "Administracion, SaaS y gobierno",
    permission: "administracion",
    summary:
      "Agrupa configuraciones de alto nivel, gobierno del sistema, control comercial y mantenimiento interno.",
    capabilities: [
      "Checklist inicial, dashboard general, configuracion general y herramientas administrativas.",
      "Gestion de empresa, suscripcion, branding, DNIT y esquema comercial del tenant.",
      "Administracion de usuarios, roles, auditoria y pagina institucional del sistema.",
    ],
    routes: [
      "/configuracion/inicial",
      "/dashboard/general",
      "/usuarios",
      "/roles",
      "/auditoria",
      "/admin",
      "/configuracion",
      "/configuracion/comercial",
      "/configuracion/dnit",
      "/acerca-de",
    ],
  },
];

export const systemGuideFlows: GuideFlow[] = [
  {
    title: "Puesta en marcha",
    steps: [
      "Registrar o seleccionar la empresa y validar su estado comercial.",
      "Definir roles, permisos, usuarios y parametros base.",
      "Completar checklist inicial y cargar maestros necesarios para operar.",
    ],
  },
  {
    title: "Flujo productivo",
    steps: [
      "Crear parcelas, cultivos y zafras activas.",
      "Registrar monitoreos, eventos y consumos de insumos o servicios.",
      "Analizar desempeno y costos desde paneles, reportes por parcela y reportes por zafra.",
    ],
  },
  {
    title: "Flujo comercial y financiero",
    steps: [
      "Registrar clientes, proveedores, compras y ventas.",
      "Convertir la operacion en cuentas por cobrar, cuentas por pagar y movimientos de tesoreria.",
      "Revisar costos, ingresos, rentabilidad y situacion financiera desde dashboards y reportes.",
    ],
  },
  {
    title: "Flujo RRHH y liquidacion",
    steps: [
      "Mantener nomina de empleados y registrar asistencias o control horario.",
      "Importar datos biometricos cuando aplique y validar horas trabajadas.",
      "Liquidar jornales, emitir comprobantes y dejar trazabilidad del proceso.",
    ],
  },
  {
    title: "Flujo contable",
    steps: [
      "Configurar plan de cuentas, centros de costo, monedas y cuentas de caja o banco.",
      "Registrar o generar movimientos con impacto contable.",
      "Consultar diario, mayor y balance para control y cierre.",
    ],
  },
];

export const systemGuideIntegrations: GuideItem[] = [
  {
    title: "Integracion DNIT",
    description:
      "La consulta de contribuyentes se realiza a traves de Cloud Functions para no exponer la clave en el cliente y mantener el proceso protegido.",
  },
  {
    title: "Cloud Functions",
    description:
      "El backend expone procesos de apoyo como lookup de DNIT, liquidacion y operaciones vinculadas a tenants o migraciones.",
  },
  {
    title: "Asistente operativo",
    description:
      "Existe un asistente interno para consultas rapidas de stock, estados de cuenta, costos y accesos a modulos, con trazabilidad en auditoria.",
  },
  {
    title: "Reportes y exportacion",
    description:
      "Las pantallas clave pueden imprimirse, compartirse y exportarse a PDF, permitiendo uso operativo y comunicacion con terceros.",
  },
];

export const systemGuideEvolution: GuideItem[] = [
  {
    title: "Documento vivo",
    description:
      "La guia debe actualizarse cada vez que se incorporen modulos, cambien flujos o se definan nuevas reglas de negocio.",
  },
  {
    title: "Detalle por modulo",
    description:
      "Una siguiente etapa natural es sumar procedimientos paso a paso, politicas operativas y ejemplos visuales por pantalla.",
  },
  {
    title: "Governance del sistema",
    description:
      "Conviene mantener un historial de cambios funcionales para que interesados y nuevos usuarios entiendan la evolucion del proyecto.",
  },
];

export const permissionLabels: Record<keyof Permisos, string> = {
  compras: "Compras",
  stock: "Stock",
  eventos: "Eventos",
  monitoreos: "Monitoreos",
  ventas: "Ventas",
  contabilidad: "Contabilidad",
  rrhh: "RRHH",
  finanzas: "Finanzas",
  agronomia: "Agronomia",
  maestros: "Maestros",
  usuarios: "Usuarios",
  roles: "Roles",
  administracion: "Administracion",
};

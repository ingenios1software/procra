import { FieldValue, Firestore } from "firebase-admin/firestore";

export const TENANT_DEMO_SEED_TAG = "seed-demo";

const BATCH_CHUNK_SIZE = 400;
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
  usuarios: true,
  roles: true,
  administracion: true,
} as const;

const TENANT_DEMO_COLLECTIONS = [
  "cultivos",
  "zafras",
  "parcelas",
  "tiposEvento",
  "etapasCultivo",
  "insumos",
  "lotesInsumos",
  "clientes",
  "proveedores",
  "comprasNormal",
  "eventos",
  "ventas",
  "cuentasPorCobrar",
  "cuentasPorPagar",
  "asientosDiario",
  "MovimientosStock",
  "stockGranos",
  "rendimientosAgricolas",
  "empleados",
  "tiposTrabajo",
  "controlHorario",
  "asistencias",
  "dnitContribuyentes",
] as const;

type TenantDemoCollection = (typeof TENANT_DEMO_COLLECTIONS)[number];

type DemoWrite = {
  path: string;
  data: Record<string, unknown>;
};

export type TenantDemoSeedResult = {
  ok: true;
  empresaId: string;
  collections: TenantDemoCollection[];
  documents: number;
  resetApplied: boolean;
  seedTag: string;
};

export type TenantDemoClearResult = {
  empresaId: string;
  collections: TenantDemoCollection[];
  deleted: number;
  dryRun: boolean;
  seedTag: string;
};

function toIso(date: Date): string {
  return date.toISOString();
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return toIso(next);
}

async function writeInChunks(db: Firestore, writes: DemoWrite[]): Promise<void> {
  for (let index = 0; index < writes.length; index += BATCH_CHUNK_SIZE) {
    const chunk = writes.slice(index, index + BATCH_CHUNK_SIZE);
    const batch = db.batch();

    chunk.forEach((item) => {
      batch.set(db.doc(item.path), item.data, { merge: true });
    });

    await batch.commit();
  }
}

function buildSeedBaseWrites(empresaId: string): DemoWrite[] {
  const now = new Date();
  const nowIso = toIso(now);
  const demoEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  return [
    {
      path: `empresas/${empresaId}`,
      data: {
        nombre: `Empresa Demo ${empresaId}`,
        activo: true,
        perfil: {
          contacto: "Administrador Demo",
          email: "demo@procra.local",
          pais: "Paraguay",
        },
        branding: {
          preparedBy: "Responsable",
          approvedBy: "Administracion",
        },
        modulos: { ...DEFAULT_COMPANY_MODULES },
        demo: {
          habilitado: true,
          inicio: nowIso,
          fin: demoEnd,
        },
        suscripcion: {
          estado: "trial",
          plan: "demo",
          modeloCobro: "por_empresa",
          moneda: "USD",
          montoMensual: 0,
          maxUsuarios: 3,
          proximoCobro: null,
        },
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
    },
    {
      path: `empresas/${empresaId}/roles/admin`,
      data: {
        nombre: "admin",
        descripcion: "Administrador de la empresa cliente.",
        permisos: { ...DEFAULT_COMPANY_MODULES },
        soloLectura: false,
        esSistema: true,
      },
    },
    {
      path: `empresas/${empresaId}/roles/tecnico`,
      data: {
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
    },
    {
      path: `empresas/${empresaId}/roles/operador`,
      data: {
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
    },
    {
      path: `empresas/${empresaId}/roles/consulta`,
      data: {
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
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/caja_general`,
      data: { codigo: "1.1.1", nombre: "Caja General", tipo: "activo", naturaleza: "deudora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/clientes`,
      data: { codigo: "1.1.3", nombre: "Clientes", tipo: "activo", naturaleza: "deudora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/inventario`,
      data: { codigo: "1.1.4", nombre: "Inventario", tipo: "activo", naturaleza: "deudora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/proveedores`,
      data: { codigo: "2.1.1", nombre: "Proveedores", tipo: "pasivo", naturaleza: "acreedora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/iva_debito`,
      data: { codigo: "2.1.2", nombre: "IVA Debito Fiscal", tipo: "pasivo", naturaleza: "acreedora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/ventas`,
      data: { codigo: "4.1.1", nombre: "Ventas", tipo: "ingreso", naturaleza: "acreedora" },
    },
    {
      path: `empresas/${empresaId}/planDeCuentas/cmv`,
      data: { codigo: "5.1.1", nombre: "Costo de Mercaderias Vendidas", tipo: "costo", naturaleza: "deudora" },
    },
    {
      path: `empresas/${empresaId}/monedas/PYG`,
      data: { codigo: "PYG", descripcion: "Guarani Paraguayo", tasaCambio: 1, esMonedaBase: true },
    },
    {
      path: `empresas/${empresaId}/monedas/USD`,
      data: { codigo: "USD", descripcion: "Dolar Estadounidense", tasaCambio: 7300, esMonedaBase: false },
    },
    {
      path: `empresas/${empresaId}/depositos/deposito_principal`,
      data: { nombre: "Deposito Principal", descripcion: "Deposito base para operaciones demo.", activo: true },
    },
    {
      path: `empresas/${empresaId}/cuentasCajaBanco/caja_principal_pyg`,
      data: {
        nombre: "Caja Principal Gs",
        tipo: "CAJA",
        monedaId: "PYG",
        cuentaContableId: "caja_general",
        activo: true,
      },
    },
    {
      path: `empresas/${empresaId}/cultivos/cultivo_inicial`,
      data: { nombre: "Cultivo Inicial", descripcion: "Cultivo base para configuracion inicial.", numeroItem: 0 },
    },
    {
      path: `empresas/${empresaId}/zafras/zafra_inicial`,
      data: {
        nombre: "Zafra Inicial",
        fechaInicio: nowIso,
        estado: "en curso",
        cultivoId: "cultivo_inicial",
        numeroItem: 0,
      },
    },
  ];
}

function buildTenantDemoWrites(empresaId: string, requestedByUid: string): DemoWrite[] {
  const now = new Date();
  const nowIso = toIso(now);
  const yesterdayIso = addDays(now, -1);
  const threeDaysAgoIso = addDays(now, -3);
  const fifteenDaysAgoIso = addDays(now, -15);
  const tenDaysAgoIso = addDays(now, -10);
  const tenDaysAheadIso = addDays(now, 10);
  const seedExpiryIso = "2026-09-30T00:00:00.000Z";
  const herbicideExpiryIso = "2027-01-31T00:00:00.000Z";

  const cultivoId = "cultivo_demo_soja";
  const zafraId = "zafra_demo_2025_2026";
  const parcelaNorteId = "parcela_demo_norte";
  const parcelaSurId = "parcela_demo_sur";
  const tipoEventoSiembraId = "tipo_evento_demo_siembra";
  const tipoEventoAplicacionId = "tipo_evento_demo_aplicacion";
  const tipoEventoCosechaId = "tipo_evento_demo_cosecha";
  const insumoSemillaId = "insumo_demo_semilla_soja";
  const insumoHerbicidaId = "insumo_demo_herbicida";
  const insumoGranoId = "grano-cultivo_demo_soja";
  const clienteId = "cliente_demo_exportadora";
  const proveedorId = "proveedor_demo_agroinsumos";
  const compraId = "compra_demo_inicial";
  const ventaId = "venta_demo_inicial";
  const cuentaPorCobrarId = ventaId;
  const cuentaPorPagarId = compraId;
  const asientoCompraId = "asiento_demo_compra";
  const asientoVentaId = "asiento_demo_venta";
  const asientoCmvId = "asiento_demo_cmv";
  const loteSemillaId = "lote_demo_semilla_soja";
  const loteHerbicidaId = "lote_demo_herbicida";
  const stockGranoId = `${insumoGranoId}__${zafraId}__${parcelaNorteId}`;
  const rendimientoId = `${zafraId}__${cultivoId}__${parcelaNorteId}`;

  const seedMeta = {
    empresaId,
    seedTag: TENANT_DEMO_SEED_TAG,
    actualizadoEn: nowIso,
  };

  return [
    {
      path: `empresas/${empresaId}/cultivos/cultivo_demo_soja`,
      data: {
        nombre: "Soja Demo",
        descripcion: "Cultivo de ejemplo para reportes, eventos y ventas iniciales.",
        numeroItem: 1,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/zafras/zafra_demo_2025_2026`,
      data: {
        nombre: "Zafra Demo 2025-2026",
        fechaInicio: "2025-07-01T00:00:00.000Z",
        fechaFin: "2026-06-30T00:00:00.000Z",
        estado: "en curso",
        cultivoId,
        fechaSiembra: "2025-09-15T00:00:00.000Z",
        numeroItem: 1,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/parcelas/parcela_demo_norte`,
      data: {
        nombre: "Parcela Norte",
        codigo: "PAR-DEMO-001",
        superficie: 24,
        ubicacion: "Limpio, Central",
        estado: "activa",
        sector: "Norte",
        cultivoActual: "Soja Demo",
        numeroItem: 1,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/parcelas/parcela_demo_sur`,
      data: {
        nombre: "Parcela Sur",
        codigo: "PAR-DEMO-002",
        superficie: 18,
        ubicacion: "Villeta, Central",
        estado: "activa",
        sector: "Sur",
        cultivoActual: "Soja Demo",
        numeroItem: 2,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/tiposEvento/tipo_evento_demo_siembra`,
      data: {
        nombre: "Siembra",
        tipoBase: "siembra",
        activo: true,
        orden: 1,
        descripcion: "Tipo de evento demo para implantacion.",
        esSistema: true,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/tiposEvento/tipo_evento_demo_aplicacion`,
      data: {
        nombre: "Aplicacion",
        tipoBase: "aplicacion",
        activo: true,
        orden: 2,
        descripcion: "Tipo de evento demo para manejo agronomico.",
        esSistema: true,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/tiposEvento/${tipoEventoCosechaId}`,
      data: {
        nombre: "Cosecha",
        tipoBase: "cosecha",
        activo: true,
        orden: 3,
        descripcion: "Tipo de evento demo para ingreso de granos.",
        esSistema: true,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/etapasCultivo/etapa_demo_emergencia`,
      data: {
        nombre: "Emergencia",
        cultivoId,
        orden: 1,
        descripcion: "Etapa inicial posterior a la siembra.",
        diasDesdeSiembraInicio: 0,
        diasDesdeSiembraFin: 15,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/etapasCultivo/etapa_demo_vegetativo`,
      data: {
        nombre: "Vegetativo",
        cultivoId,
        orden: 2,
        descripcion: "Desarrollo vegetativo y manejo sanitario.",
        diasDesdeSiembraInicio: 16,
        diasDesdeSiembraFin: 60,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/etapasCultivo/etapa_demo_reproductivo`,
      data: {
        nombre: "Reproductivo",
        cultivoId,
        orden: 3,
        descripcion: "Llenado de grano y preparacion de cosecha.",
        diasDesdeSiembraInicio: 61,
        diasDesdeSiembraFin: 120,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/insumos/${insumoSemillaId}`,
      data: {
        nombre: "Semilla Soja DM-51",
        codigo: "INS-DEMO-001",
        descripcion: "Semilla demo para labores iniciales.",
        categoria: "semillas",
        unidad: "kg",
        iva: "10",
        costoUnitario: 3800,
        precioPromedioCalculado: 3800,
        precioVenta: 4500,
        stockMinimo: 200,
        stockActual: 1020,
        proveedor: "Agroinsumos Demo",
        controlaLotes: true,
        controlaVencimiento: true,
        diasAlertaVencimiento: 60,
        numeroItem: 1,
        ultimaCompra: fifteenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/insumos/${insumoHerbicidaId}`,
      data: {
        nombre: "Herbicida Total Demo",
        codigo: "INS-DEMO-002",
        descripcion: "Producto demo para aplicaciones agronomicas.",
        categoria: "agroquimico",
        unidad: "lt",
        iva: "10",
        costoUnitario: 25000,
        precioPromedioCalculado: 25000,
        precioVenta: 32000,
        stockMinimo: 20,
        stockActual: 156,
        proveedor: "Agroinsumos Demo",
        controlaLotes: true,
        controlaVencimiento: true,
        diasAlertaVencimiento: 90,
        numeroItem: 2,
        ultimaCompra: tenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/insumos/${insumoGranoId}`,
      data: {
        nombre: "Grano de Soja Demo",
        codigo: "GRANO-SOJA-DEMO",
        descripcion: "Grano comercial generado a partir de la cosecha demo.",
        categoria: "grano",
        unidad: "ton",
        iva: "0",
        costoUnitario: 1450000,
        precioPromedioCalculado: 1450000,
        precioVenta: 1620000,
        stockMinimo: 5,
        stockActual: 18,
        proveedor: "Produccion Propia Demo",
        controlaLotes: false,
        numeroItem: 3,
        ultimaCompra: yesterdayIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/clientes/${clienteId}`,
      data: {
        nombre: "Exportadora Demo S.A.",
        ruc: "80000001-2",
        direccion: "Av. Costanera 1000",
        telefono: "0981000000",
        email: "compras@demo-exportadora.local",
        ciudad: "Asuncion",
        pais: "Paraguay",
        tipoCliente: "exportadora",
        activo: true,
        observaciones: "Cliente de ejemplo para cobranzas y ventas.",
        fechaRegistro: tenDaysAgoIso,
        creadoPor: requestedByUid,
        numeroItem: 1,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/proveedores/${proveedorId}`,
      data: {
        nombre: "Agroinsumos Demo",
        ruc: "80000002-0",
        direccion: "Ruta 2 km 15",
        telefono: "0982000000",
        email: "ventas@agrodemo.local",
        ciudad: "Capiata",
        pais: "Paraguay",
        contacto: "Maria Insumos",
        activo: true,
        observaciones: "Proveedor de ejemplo para carga inicial.",
        fechaRegistro: fifteenDaysAgoIso,
        creadoPor: requestedByUid,
        numeroItem: 1,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/comprasNormal/${compraId}`,
      data: {
        codigo: 1,
        fechaEmision: fifteenDaysAgoIso,
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        planFinanciacion: "Zafra Demo 2025-2026",
        moneda: "PYG",
        condicionCompra: "Crédito",
        entidadId: proveedorId,
        formaPago: "Transferencia",
        totalizadora: false,
        observacion: "Compra demo con mercaderias reales para stock inicial.",
        totalMercaderias: 9060000,
        totalFlete: 0,
        totalFactura: 9060000,
        estado: "abierto",
        usuario: requestedByUid,
        timestamp: FieldValue.serverTimestamp(),
        mercaderias: [
          {
            insumoId: insumoSemillaId,
            cantidad: 1200,
            valorUnitario: 3800,
            lote: "LOT-SEMI-001",
            fechaVencimiento: seedExpiryIso,
            sinVencimiento: false,
          },
          {
            insumoId: insumoHerbicidaId,
            cantidad: 180,
            valorUnitario: 25000,
            lote: "LOT-HERB-001",
            fechaVencimiento: herbicideExpiryIso,
            sinVencimiento: false,
          },
        ],
        flete: {
          valor: 0,
        },
        financiero: {
          valor: 9060000,
          cuentaInventarioId: "inventario",
          cuentaPorPagarId: "proveedores",
          asientoRegistroId: asientoCompraId,
          vencimiento: tenDaysAheadIso,
        },
        comprobante: {
          documento: "FAC-DEMO-0001",
          timbre: "12345678",
        },
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/cuentasPorPagar/${cuentaPorPagarId}`,
      data: {
        compraId,
        compraDocumento: "FAC-DEMO-0001",
        proveedorId,
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        fechaEmision: fifteenDaysAgoIso,
        fechaVencimiento: tenDaysAheadIso,
        moneda: "PYG",
        montoOriginal: 9060000,
        montoPagado: 0,
        saldoPendiente: 9060000,
        estado: "abierta",
        cuentaContableId: "proveedores",
        asientoRegistroId: asientoCompraId,
        observacion: "Cuenta por pagar demo asociada a la compra inicial.",
        creadoPor: requestedByUid,
        creadoEn: FieldValue.serverTimestamp(),
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/lotesInsumos/${loteSemillaId}`,
      data: {
        insumoId: insumoSemillaId,
        codigoLote: "LOT-SEMI-001",
        costoUnitario: 3800,
        fechaIngreso: fifteenDaysAgoIso,
        fechaVencimiento: seedExpiryIso,
        cantidadInicial: 1200,
        cantidadDisponible: 1020,
        estado: "activo",
        origen: "compra",
        origenId: compraId,
        creadoPor: requestedByUid,
        creadoEn: fifteenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/lotesInsumos/${loteHerbicidaId}`,
      data: {
        insumoId: insumoHerbicidaId,
        codigoLote: "LOT-HERB-001",
        costoUnitario: 25000,
        fechaIngreso: fifteenDaysAgoIso,
        fechaVencimiento: herbicideExpiryIso,
        cantidadInicial: 180,
        cantidadDisponible: 156,
        estado: "activo",
        origen: "compra",
        origenId: compraId,
        creadoPor: requestedByUid,
        creadoEn: fifteenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/eventos/evento_demo_siembra`,
      data: {
        numeroLanzamiento: 1,
        parcelaId: parcelaNorteId,
        cultivoId,
        zafraId,
        tipo: "siembra",
        tipoNombre: "Siembra",
        tipoEventoId: tipoEventoSiembraId,
        fecha: tenDaysAgoIso,
        descripcion: "Siembra demo sobre parcela norte.",
        resultado: "Emergencia uniforme.",
        numeroItem: 1,
        estado: "aprobado",
        creadoPor: requestedByUid,
        creadoEn: tenDaysAgoIso,
        aprobadoPor: requestedByUid,
        aprobadoPorNombre: "Admin Demo",
        aprobadoEn: tenDaysAgoIso,
        categoria: "Siembra",
        productos: [{ insumoId: insumoSemillaId, cantidad: 180, dosis: 7.5 }],
        hectareasAplicadas: 24,
        costoTotal: 684000,
        costoPorHa: 28500,
        cuentaContableId: "inventario",
        stockProcesadoEn: tenDaysAgoIso,
        stockProcesadoPor: requestedByUid,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/eventos/evento_demo_aplicacion`,
      data: {
        numeroLanzamiento: 2,
        parcelaId: parcelaSurId,
        cultivoId,
        zafraId,
        tipo: "aplicacion",
        tipoNombre: "Aplicacion",
        tipoEventoId: tipoEventoAplicacionId,
        fecha: threeDaysAgoIso,
        descripcion: "Aplicacion demo de herbicida preemergente.",
        resultado: "Cobertura correcta y deriva controlada.",
        numeroItem: 2,
        estado: "aprobado",
        creadoPor: requestedByUid,
        creadoEn: threeDaysAgoIso,
        aprobadoPor: requestedByUid,
        aprobadoPorNombre: "Admin Demo",
        aprobadoEn: threeDaysAgoIso,
        categoria: "Herbicida",
        productos: [{ insumoId: insumoHerbicidaId, cantidad: 24, dosis: 1.3 }],
        hectareasAplicadas: 18,
        costoTotal: 600000,
        costoPorHa: 33333,
        cuentaContableId: "inventario",
        stockProcesadoEn: threeDaysAgoIso,
        stockProcesadoPor: requestedByUid,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/eventos/evento_demo_cosecha`,
      data: {
        numeroLanzamiento: 3,
        parcelaId: parcelaNorteId,
        cultivoId,
        zafraId,
        tipo: "cosecha",
        tipoNombre: "Cosecha",
        tipoEventoId: tipoEventoCosechaId,
        fecha: yesterdayIso,
        descripcion: "Cosecha demo con ingreso de grano comercial.",
        resultado: "Ingreso de 25 toneladas a stock.",
        numeroItem: 3,
        estado: "aprobado",
        creadoPor: requestedByUid,
        creadoEn: yesterdayIso,
        aprobadoPor: requestedByUid,
        aprobadoPorNombre: "Admin Demo",
        aprobadoEn: yesterdayIso,
        categoria: "Cosecha",
        hectareasAplicadas: 24,
        toneladas: 25,
        precioTonelada: 1450000,
        hectareasRendimiento: 24,
        rendimientoTonHa: 1.0417,
        rendimientoKgHa: 1041.67,
        costoServicioPorHa: 80000,
        costoServicioTotal: 1920000,
        cuentaContableId: "inventario",
        stockProcesadoEn: yesterdayIso,
        stockProcesadoPor: requestedByUid,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/empleados/empleado_demo_juan`,
      data: {
        codigo: "EMP-001",
        nombre: "Juan",
        apellido: "Perez",
        documento: "10010001",
        fechaNacimiento: "1990-04-10T00:00:00.000Z",
        fechaContratacion: "2024-01-15T00:00:00.000Z",
        puesto: "Encargado de Campo",
        salario: 4200000,
        estado: "activo",
        telefono: "0971000001",
        email: "juan.perez@demo.local",
        direccion: "Limpio",
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/empleados/empleado_demo_pedro`,
      data: {
        codigo: "EMP-002",
        nombre: "Pedro",
        apellido: "Ruiz",
        documento: "10010002",
        fechaNacimiento: "1992-07-22T00:00:00.000Z",
        fechaContratacion: "2024-02-10T00:00:00.000Z",
        puesto: "Operario",
        salario: 3600000,
        estado: "activo",
        telefono: "0971000002",
        email: "pedro.ruiz@demo.local",
        direccion: "Villeta",
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/tiposTrabajo/tipo_trabajo_demo_siembra`,
      data: {
        nombre: "Siembra",
        activo: true,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/tiposTrabajo/tipo_trabajo_demo_mantenimiento`,
      data: {
        nombre: "Mantenimiento",
        activo: true,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/controlHorario/control_demo_1`,
      data: {
        empleadoId: "empleado_demo_juan",
        fecha: yesterdayIso.slice(0, 10),
        depositoId: "deposito_principal",
        local: "Campo Norte",
        tipoTrabajo: "Siembra",
        precioHoraGs: 22000,
        actividades: [
          {
            parcelaId: "parcela_demo_norte",
            horaInicio: "07:00",
            horaFin: "12:00",
            descripcion: "Ajuste de sembradora y control de avance.",
          },
          {
            parcelaId: "parcela_demo_sur",
            horaInicio: "13:00",
            horaFin: "16:00",
            descripcion: "Supervision de aplicacion.",
          },
        ],
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/controlHorario/control_demo_2`,
      data: {
        empleadoId: "empleado_demo_pedro",
        fecha: yesterdayIso.slice(0, 10),
        depositoId: "deposito_principal",
        local: "Campo Sur",
        tipoTrabajo: "Mantenimiento",
        precioHoraGs: 18000,
        actividades: [
          {
            parcelaId: "parcela_demo_sur",
            horaInicio: "07:30",
            horaFin: "11:30",
            descripcion: "Limpieza de cabeceras y apoyo logistico.",
          },
        ],
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/asistencias/asistencia_demo_1`,
      data: {
        empleadoId: "empleado_demo_juan",
        fecha: yesterdayIso,
        horaEntrada: "07:00",
        horaSalida: "16:00",
        observaciones: "Jornada completa en parcela norte.",
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/asistencias/asistencia_demo_2`,
      data: {
        empleadoId: "empleado_demo_pedro",
        fecha: yesterdayIso,
        horaEntrada: "07:30",
        horaSalida: "15:30",
        observaciones: "Apoyo operativo y mantenimiento.",
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/ventas/${ventaId}`,
      data: {
        numeroDocumento: "VTA-DEMO-0001",
        clienteId,
        zafraId,
        cultivoId,
        fecha: nowIso,
        moneda: "PYG",
        formaPago: "Crédito",
        totalizadora: false,
        vencimiento: tenDaysAheadIso,
        vendedorId: requestedByUid,
        depositoOrigenId: "deposito_principal",
        observacion: "Venta demo generada automaticamente para el tenant.",
        items: [
          {
            productoId: insumoGranoId,
            descripcion: "Grano de Soja Demo",
            cantidad: 7,
            precioUnitario: 1620000,
            descuentoPorc: 0,
            subtotal: 11340000,
          },
        ],
        total: 11340000,
        toneladas: 7,
        precioTonelada: 1620000,
        financiero: {
          cuentaCobroId: "clientes",
          total: 11340000,
          vencimiento: tenDaysAheadIso,
          asientoVentaId,
          asientoCmvId,
        },
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/cuentasPorCobrar/${cuentaPorCobrarId}`,
      data: {
        ventaId,
        ventaDocumento: "VTA-DEMO-0001",
        clienteId,
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        fechaEmision: nowIso,
        fechaVencimiento: tenDaysAheadIso,
        moneda: "PYG",
        montoOriginal: 11340000,
        montoCobrado: 0,
        saldoPendiente: 11340000,
        estado: "abierta",
        cuentaContableId: "clientes",
        asientoVentaId: "asiento_demo_venta",
        observacion: "Cuenta por cobrar de ejemplo.",
        creadoPor: requestedByUid,
        creadoEn: FieldValue.serverTimestamp(),
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/asientosDiario/${asientoCompraId}`,
      data: {
        fecha: fifteenDaysAgoIso,
        descripcion: "Compra demo FAC-DEMO-0001",
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        movimientos: [
          { cuentaId: "inventario", tipo: "debe", monto: 9060000 },
          { cuentaId: "proveedores", tipo: "haber", monto: 9060000 },
        ],
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/asientosDiario/${asientoVentaId}`,
      data: {
        fecha: nowIso,
        descripcion: "Venta demo VTA-DEMO-0001",
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        movimientos: [
          { cuentaId: "clientes", tipo: "debe", monto: 11340000 },
          { cuentaId: "ventas", tipo: "haber", monto: 10309091 },
          { cuentaId: "iva_debito", tipo: "haber", monto: 1030909 },
        ],
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/asientosDiario/${asientoCmvId}`,
      data: {
        fecha: nowIso,
        descripcion: "CMV demo VTA-DEMO-0001",
        zafraId,
        zafraNombre: "Zafra Demo 2025-2026",
        movimientos: [
          { cuentaId: "cmv", tipo: "debe", monto: 10150000 },
          { cuentaId: "inventario", tipo: "haber", monto: 10150000 },
        ],
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_compra_semilla`,
      data: {
        fecha: fifteenDaysAgoIso,
        tipo: "entrada",
        origen: "compra",
        compraId,
        documentoOrigen: "FAC-DEMO-0001",
        zafraId,
        insumoId: insumoSemillaId,
        insumoNombre: "Semilla Soja DM-51",
        unidad: "kg",
        categoria: "semillas",
        cantidad: 1200,
        stockAntes: 0,
        stockDespues: 1200,
        precioUnitario: 3800,
        costoTotal: 4560000,
        lote: "LOT-SEMI-001",
        loteVencimiento: seedExpiryIso,
        creadoPor: requestedByUid,
        creadoEn: fifteenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_compra_herbicida`,
      data: {
        fecha: fifteenDaysAgoIso,
        tipo: "entrada",
        origen: "compra",
        compraId,
        documentoOrigen: "FAC-DEMO-0001",
        zafraId,
        insumoId: insumoHerbicidaId,
        insumoNombre: "Herbicida Total Demo",
        unidad: "lt",
        categoria: "agroquimico",
        cantidad: 180,
        stockAntes: 0,
        stockDespues: 180,
        precioUnitario: 25000,
        costoTotal: 4500000,
        lote: "LOT-HERB-001",
        loteVencimiento: herbicideExpiryIso,
        creadoPor: requestedByUid,
        creadoEn: fifteenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_siembra`,
      data: {
        fecha: tenDaysAgoIso,
        tipo: "salida",
        origen: "evento",
        eventoId: "evento_demo_siembra",
        documentoOrigen: "EV-1",
        parcelaId: parcelaNorteId,
        parcelaNombre: "Parcela Norte",
        zafraId,
        cultivo: "Soja Demo",
        insumoId: insumoSemillaId,
        insumoNombre: "Semilla Soja DM-51",
        unidad: "kg",
        categoria: "semillas",
        cantidad: 180,
        stockAntes: 1200,
        stockDespues: 1020,
        precioUnitario: 3800,
        costoTotal: 684000,
        creadoPor: requestedByUid,
        creadoEn: tenDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_aplicacion`,
      data: {
        fecha: threeDaysAgoIso,
        tipo: "salida",
        origen: "evento",
        eventoId: "evento_demo_aplicacion",
        documentoOrigen: "EV-2",
        parcelaId: parcelaSurId,
        parcelaNombre: "Parcela Sur",
        zafraId,
        cultivo: "Soja Demo",
        insumoId: insumoHerbicidaId,
        insumoNombre: "Herbicida Total Demo",
        unidad: "lt",
        categoria: "agroquimico",
        cantidad: 24,
        stockAntes: 180,
        stockDespues: 156,
        precioUnitario: 25000,
        costoTotal: 600000,
        creadoPor: requestedByUid,
        creadoEn: threeDaysAgoIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_cosecha`,
      data: {
        fecha: yesterdayIso,
        tipo: "entrada",
        origen: "evento",
        eventoId: "evento_demo_cosecha",
        documentoOrigen: "EV-3",
        parcelaId: parcelaNorteId,
        parcelaNombre: "Parcela Norte",
        zafraId,
        cultivo: "Soja Demo",
        insumoId: insumoGranoId,
        insumoNombre: "Grano de Soja Demo",
        unidad: "ton",
        categoria: "grano",
        cantidad: 25,
        stockAntes: 0,
        stockDespues: 25,
        precioUnitario: 1450000,
        costoTotal: 36250000,
        creadoPor: requestedByUid,
        creadoEn: yesterdayIso,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/MovimientosStock/mov_stock_demo_venta`,
      data: {
        fecha: nowIso,
        tipo: "salida",
        origen: "venta",
        documentoOrigen: "VTA-DEMO-0001",
        ventaId,
        depositoId: "deposito_principal",
        zafraId,
        parcelaId: parcelaNorteId,
        parcelaNombre: "Parcela Norte",
        cultivo: "Soja Demo",
        insumoId: insumoGranoId,
        insumoNombre: "Grano de Soja Demo",
        unidad: "ton",
        categoria: "grano",
        cantidad: 7,
        stockAntes: 25,
        stockDespues: 18,
        precioUnitario: 1620000,
        costoTotal: 11340000,
        subtotal: 11340000,
        creadoPor: requestedByUid,
        creadoEn: now,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/stockGranos/${stockGranoId}`,
      data: {
        insumoId: insumoGranoId,
        insumoNombre: "Grano de Soja Demo",
        zafraId,
        parcelaId: parcelaNorteId,
        parcelaNombre: "Parcela Norte",
        cultivoId,
        cultivoNombre: "Soja Demo",
        unidad: "ton",
        stockActual: 18,
        precioPromedio: 1450000,
        valorTotal: 26100000,
        creadoEn: yesterdayIso,
        actualizadoPor: requestedByUid,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/rendimientosAgricolas/${rendimientoId}`,
      data: {
        zafraId,
        cultivoId,
        parcelaId: parcelaNorteId,
        zafraNombre: "Zafra Demo 2025-2026",
        cultivoNombre: "Soja Demo",
        parcelaNombre: "Parcela Norte",
        hectareasBase: 24,
        toneladasAcumuladas: 25,
        kilosAcumulados: 25000,
        rendimientoTonHa: 1.0417,
        rendimientoKgHa: 1041.67,
        ultimoEventoId: "evento_demo_cosecha",
        ultimaFecha: yesterdayIso,
        creadoEn: yesterdayIso,
        actualizadoPor: requestedByUid,
        ...seedMeta,
      },
    },
    {
      path: `empresas/${empresaId}/dnitContribuyentes/80000001-2`,
      data: {
        ruc: "80000001",
        dv: "2",
        documento: "80000001-2",
        razonSocial: "Exportadora Demo S.A.",
        nombreComercial: "Exportadora Demo",
        estado: "ACTIVO",
        categoria: "GENERAL",
        tipoPersona: "JURIDICA",
        consultadoEn: nowIso,
        fuente: "dnit",
        searchName: "Exportadora Demo",
        searchDocument: "80000001-2",
        searchText: "exportadora demo exportadora demo s.a. 80000001-2",
        ...seedMeta,
      },
    },
  ];
}

export async function clearTenantDemoData(
  db: Firestore,
  params: { empresaId: string; dryRun?: boolean }
): Promise<TenantDemoClearResult> {
  const { empresaId, dryRun = false } = params;
  let deleted = 0;

  for (const collectionName of TENANT_DEMO_COLLECTIONS) {
    const snap = await db
      .collection(`empresas/${empresaId}/${collectionName}`)
      .where("seedTag", "==", TENANT_DEMO_SEED_TAG)
      .get();

    deleted += snap.size;
    if (dryRun || snap.empty) {
      continue;
    }

    for (let index = 0; index < snap.docs.length; index += BATCH_CHUNK_SIZE) {
      const chunk = snap.docs.slice(index, index + BATCH_CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  return {
    empresaId,
    collections: [...TENANT_DEMO_COLLECTIONS],
    deleted,
    dryRun,
    seedTag: TENANT_DEMO_SEED_TAG,
  };
}

export async function seedTenantDemoDataCore(
  db: Firestore,
  params: { empresaId: string; requestedByUid: string; reset?: boolean }
): Promise<TenantDemoSeedResult> {
  const { empresaId, requestedByUid, reset = false } = params;

  if (reset) {
    await clearTenantDemoData(db, { empresaId });
  }

  const writes = [...buildSeedBaseWrites(empresaId), ...buildTenantDemoWrites(empresaId, requestedByUid)];
  await writeInChunks(db, writes);

  return {
    ok: true,
    empresaId,
    collections: [...TENANT_DEMO_COLLECTIONS],
    documents: writes.length,
    resetApplied: reset,
    seedTag: TENANT_DEMO_SEED_TAG,
  };
}

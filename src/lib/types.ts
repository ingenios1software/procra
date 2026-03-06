import type { FieldValue } from 'firebase/firestore';

export type Permisos = {
  compras: boolean;
  stock: boolean;
  eventos: boolean;
  monitoreos: boolean;
  ventas: boolean;
  contabilidad: boolean;
  rrhh: boolean;
  finanzas: boolean;
  agronomia: boolean;
  maestros: boolean;
  administracion: boolean;
};

export type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number];
};

export type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type GeoJSONMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type ZafraData = {
  cultivo: string;
  color: string;
  variedad: string;
  superficie: number;
};

export type Parcela = {
  id: string;
  nombre: string;
  codigo: string;
  superficie: number; // Esto es lo mismo que hectareas
  ubicacion: string;
  estado: 'activa' | 'inactiva' | 'en barbecho';
  sector?: string;
  numeroItem?: number;
  cultivoActual?: string;
  geometry?: GeoJSONPolygon | GeoJSONMultiPolygon;
};

export type Cultivo = {
  id: string;
  nombre: string;
  descripcion: string;
  numeroItem?: number;
};

export type Zafra = {
  id:string;
  nombre: string;
  fechaInicio: Date | string;
  fechaFin?: Date | string;
  estado: 'planificada' | 'en curso' | 'finalizada';
  cultivoId?: string;
  fechaSiembra?: Date | string;
  numeroItem?: number;
};

export type Foto = {
  url: string;
  storagePath: string;
};

export type Evento = {
  id: string;
  numeroLanzamiento?: number;
  parcelaId: string;
  cultivoId: string;
  zafraId: string;
  tipo: 'siembra' | 'fertilización' | 'riego' | 'cosecha' | 'mantenimiento' | 'plagas' | 'aplicacion' | 'rendimiento';
  fecha: Date | string;
  descripcion: string;
  resultado?: string;
  numeroItem?: number;
  
  // Workflow & Audit
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  creadoPor?: string;
  creadoEn?: Date | string | FieldValue;
  aprobadoPor?: string | null;
  aprobadoEn?: Date | string | FieldValue | null;
  rechazadoPor?: string | null;
  rechazadoEn?: Date | string | FieldValue | null;
  motivoRechazo?: string | null;
  
  // Campos climáticos
  temperatura?: number;
  humedad?: number;
  viento?: number;

  // Campos para el panel agronómico y registro de insumos
  categoria?: 'Desecación' | 'Siembra' | 'Fertilizante' | 'Herbicida' | 'Fungicida' | 'Insecticida' | 'Cosecha' | 'Otros';
  productos?: {
    insumoId: string;
    // El objeto completo del insumo no se debe guardar en el evento. Se obtiene por referencia.
    cantidad: number;
    dosis: number;
  }[];
  fotos?: Foto[];
  costoTotal?: number;
  costoPorHa?: number;
  hectareasAplicadas?: number;
  costoServicioPorHa?: number;
  costoServicioTotal?: number;
  cuentaContableId?: string | null;
  maquinariaId?: string;
  horometroAnterior?: number;
  horometroActual?: number;
  horasTrabajadas?: number;
  asientoCosechaServicioId?: string | null;
  stockProcesadoEn?: Date | string;
  stockProcesadoPor?: string;


  // Campos de rendimiento y cosecha
  toneladas?: number;
  precioTonelada?: number;
  hectareasRendimiento?: number;
  rendimientoTonHa?: number;
  rendimientoKgHa?: number;

  // --- Campos depreciados / a revisar ---
  insumos?: string; // Deprecado, usar 'productos'
  cantidad?: number; // Deprecado, usar 'productos.cantidad'
  unidad?: string; // Deprecado, la unidad viene del insumo
  dosis?: number; // Deprecado, usar 'productos.dosis'
  insumoId?: string; // Deprecado, usar 'productos.insumoId'
};

export type EventoBorrador = Partial<Omit<Evento, 'id' | 'fecha'> & { fecha: Date | null }>;


export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rolId: string;
  rolNombre: string;
  empresaId?: string;
  activo: boolean;
};

export type Rol = {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: Permisos;
  soloLectura: boolean;
  esSistema?: boolean;
};

export type UserRole = 'admin' | 'operador' | 'consulta' | 'tecnicoCampo' | 'gerente' | 'auditor' | 'supervisor';

export type StatCard = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
};

export type Insumo = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  principioActivo?: string;
  unidad: 'kg' | 'lt' | 'unidad' | 'ton';
  iva: '0' | '5' | '10';
  dosisRecomendada?: number;
  costoUnitario: number; // Costo de la última compra o manual
  precioPromedioCalculado: number; // Calculado a partir de todas las compras
  precioVenta: number;
  stockMinimo: number;
  stockActual: number; // Este es el valor que se ajusta con entradas/salidas
  proveedor?: string;
  controlaLotes?: boolean;
  permiteMovimientoSinLote?: boolean;
  controlaVencimiento?: boolean;
  permiteLoteSinVencimiento?: boolean;
  diasAlertaVencimiento?: number;
  numeroItem?: number;
  ultimaCompra?: Date | string;
};

export type LoteInsumo = {
  id: string;
  insumoId: string;
  codigoLote: string;
  costoUnitario?: number;
  fechaIngreso: Date | string;
  fechaVencimiento?: Date | string | null;
  cantidadInicial: number;
  cantidadDisponible: number;
  estado: 'activo' | 'vencido' | 'agotado';
  origen: 'compra' | 'manual' | 'ajuste';
  origenId?: string;
  creadoPor: string;
  creadoEn: Date | string;
};

export type MovimientoInsumo = {
  id: string;
  insumoId: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  fecha: Date;
  origen: 'compra' | 'evento' | 'ajuste manual';
  origenId?: string; // ID de la compra, evento o ajuste
  lote?: string;
  eventoId?: string;
};

export type AjusteInsumo = {
  id: string;
  insumoId: string;
  fecha: Date;
  cantidad: number; // Positivo para agregar, negativo para quitar
  motivo: string;
  responsableId: string;
}

export type MovimientoStock = {
    id: string;
    fecha: Date | string;
    tipo: "salida" | "entrada" | "ajuste";
    origen: "evento" | "compra" | "ajuste manual" | "venta";
    documentoOrigen?: string; // Numero de factura de compra o N° de lanzamiento del evento
    eventoId?: string | null;
    compraId?: string | null;
    ventaId?: string | null;
    ajusteId?: string | null;
    depositoId?: string;
    parcelaId?: string | null;
    parcelaNombre?: string | null;
    zafraId?: string | null;
    cultivo?: string | null;
    insumoId: string;
    insumoNombre: string;
    unidad: string;
    categoria: string;
    cantidad: number;
    stockAntes: number;
    stockDespues: number;
    precioUnitario: number;
    costoTotal: number;
    lote?: string;
    loteVencimiento?: Date | string | null;
    subtotal?: number; // Para la ficha de insumo
    creadoPor: string;
    creadoEn: Date;
};

export type StockGrano = {
  id: string;
  insumoId: string;
  insumoNombre: string;
  zafraId: string;
  parcelaId: string;
  parcelaNombre?: string | null;
  cultivoId?: string | null;
  cultivoNombre?: string | null;
  unidad: "ton";
  stockActual: number;
  precioPromedio: number;
  valorTotal: number;
  creadoEn?: Date | string;
  actualizadoEn?: Date | string;
  actualizadoPor?: string;
};

export type RendimientoAgricola = {
  id: string;
  zafraId: string;
  cultivoId: string;
  parcelaId: string;
  zafraNombre?: string | null;
  cultivoNombre?: string | null;
  parcelaNombre?: string | null;
  hectareasBase: number;
  toneladasAcumuladas: number;
  kilosAcumulados: number;
  rendimientoTonHa: number;
  rendimientoKgHa: number;
  ultimoEventoId?: string;
  ultimaFecha?: Date | string;
  creadoEn?: Date | string;
  actualizadoEn?: Date | string;
  actualizadoPor?: string;
};


export type Maquinaria = {
  id: string;
  nombre: string;
  tipo: 'tractor' | 'pulverizadora' | 'camioneta' | 'cosechadora' | 'otro';
  modelo?: string;
  año?: number;
  horasTrabajo: number;
  estado: 'operativa' | 'en mantenimiento' | 'fuera de servicio';
  numeroItem?: number;
};

export type Mantenimiento = {
  id: string;
  maquinariaId: string;
  fecha: Date;
  tipo: 'cambio aceite' | 'filtro' | 'correas' | 'reparación' | 'otro';
  costo?: number;
  notas?: string;
};

// DEPRECATED: No longer used. Costs are derived from Events.
export type Costo = {
    id: string;
    parcelaId: string;
    cultivoId?: string;
    zafraId: string;
    tipo: 'insumo' | 'maquinaria' | 'combustible' | 'mano de obra' | 'otros';
    descripcion: string;
    monto: number;
    fecha: Date | string;
};

export type Venta = {
  id: string;
  numeroDocumento: string;
  clienteId: string;
  zafraId?: string;
  cultivoId?: string; // NUEVO

  fecha: Date | string;
  moneda: 'USD' | 'PYG';
  formaPago: 'Contado' | 'Transferencia' | 'Crédito';
  totalizadora?: boolean;
  vencimiento?: Date | string;
  vendedorId?: string;
  depositoOrigenId?: string;
  observacion?: string;
  items: {
    productoId: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuentoPorc: number;
    subtotal: number;
  }[];
  total: number;

  toneladas?: number; // NUEVO
  precioTonelada?: number; // NUEVO

  financiero?: {
    cuentaCobroId?: string;
    total: number;
    vencimiento?: Date | string;
    asientoVentaId?: string;
    asientoCmvId?: string;
  };
};
export type Proveedor = {
  id: string;
  nombre: string;
  ruc: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  pais?: string;
  contacto?: string;
  activo: boolean;
  observaciones?: string;
  fechaRegistro?: Date;
  creadoPor?: string;
  numeroItem?: number;
};

export type Cliente = {
  id: string;
  nombre: string;
  ruc: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  pais?: string;
  tipoCliente?: 'productor' | 'acopiador' | 'industria' | 'exportadora' | 'interno';
  activo: boolean;
  observaciones?: string;
  fechaRegistro?: Date;
  creadoPor?: string;
  numeroItem?: number;
};

export type Compra = {
  id: string;
  proveedorId: string;
  zafraId: string;
  fecha: Date | string;
  numeroDocumento: string;
  tipoDocumento: 'Factura' | 'Nota de Crédito' | 'Remisión';
  condicion: 'Contado' | 'Crédito';
  total: number;
  estado: 'Registrado' | 'Aprobado' | 'Pagado';
  observacion?: string;
  tipoCompra: 'Externa' | 'Interna';
  creadoPor?: string;
  creadoEn?: Date | string | FieldValue;
  items: {
    insumoId: string;
    cantidad: number;
    precioUnitario: number;
    porcentajeIva: '0' | '5' | '10';
  }[];
}

export type CompraNormal = {
  id: string;
  codigo?: number;
  documento?: string;
  fechaEmision: Date | string;
  zafraId?: string;
  zafraNombre?: string | null;
  planFinanciacion?: string;
  moneda: 'USD' | 'PYG';
  condicionCompra: 'Contado' | 'Crédito';
  entidadId: string; // Proveedor
  formaPago?: string;
  totalizadora: boolean;
  observacion?: string | null;
  totalMercaderias: number;
  totalFlete: number;
  totalFactura: number;
  estado: 'abierto' | 'cerrado' | 'anulado';
  usuario: string;
  timestamp: FieldValue;
  // Nested Objects
  mercaderias: {
    insumoId: string;
    insumo?: Insumo; // <-- Añadido para el formulario
    cantidad: number;
    valorUnitario: number;
    lote?: string;
    fechaVencimiento?: Date | string;
    sinVencimiento?: boolean;
  }[];
  flete: {
    transportadoraId?: string;
    datos?: string;
    cuentaAcreedora?: string;
    cuentaDeudora?: string;
    valor: number;
  };
  financiero: {
    cuentaId?: string;
    cuentaInventarioId?: string;
    cuentaPorPagarId?: string;
    cuentaPagoId?: string;
    asientoRegistroId?: string;
    asientoPagoId?: string;
    pagoAplicado?: boolean;
    fechaPago?: Date | string;
    vencimiento?: Date | string;
    valor: number;
  };
  comprobante: {
    documento: string; // Serie + Numero
    timbre: string;
    ruc?: string;
    cdc?: string;
  };
}

export type EstadoCuentaFinanciera = "abierta" | "parcial" | "cancelada" | "vencida" | "anulada";

export type CuentaPorCobrar = {
  id: string;
  ventaId: string;
  ventaDocumento?: string;
  clienteId: string;
  zafraId?: string;
  zafraNombre?: string | null;
  fechaEmision: Date | string;
  fechaVencimiento?: Date | string;
  moneda: "USD" | "PYG";
  montoOriginal: number;
  montoCobrado: number;
  saldoPendiente: number;
  estado: EstadoCuentaFinanciera;
  cuentaContableId?: string;
  asientoVentaId?: string;
  observacion?: string;
  creadoPor?: string;
  creadoEn?: Date | string | FieldValue;
  actualizadoEn?: Date | string | FieldValue;
};

export type CobroCuentaPorCobrar = {
  id: string;
  cuentaPorCobrarId: string;
  ventaId: string;
  clienteId: string;
  zafraId?: string;
  zafraNombre?: string | null;
  fecha: Date | string;
  moneda: "USD" | "PYG";
  monto: number;
  cuentaContableId: string;
  cuentaCajaBancoId?: string;
  referencia?: string;
  asientoId?: string;
  reciboId?: string;
  recibidoPor?: string;
  creadoEn?: Date | string | FieldValue;
};

export type ReciboCobro = {
  id: string;
  numero: string;
  cobroId: string;
  cuentaPorCobrarId: string;
  ventaId: string;
  clienteId: string;
  fecha: Date | string;
  moneda: "USD" | "PYG";
  monto: number;
  estado: "emitido" | "anulado";
  observacion?: string;
  emitidoPor?: string;
  creadoEn?: Date | string | FieldValue;
};

export type CuentaPorPagar = {
  id: string;
  compraId: string;
  compraDocumento?: string;
  proveedorId: string;
  zafraId?: string;
  zafraNombre?: string | null;
  fechaEmision: Date | string;
  fechaVencimiento?: Date | string;
  moneda: "USD" | "PYG";
  montoOriginal: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: EstadoCuentaFinanciera;
  cuentaContableId?: string;
  asientoRegistroId?: string;
  observacion?: string;
  creadoPor?: string;
  creadoEn?: Date | string | FieldValue;
  actualizadoEn?: Date | string | FieldValue;
};

export type PagoCuentaPorPagar = {
  id: string;
  cuentaPorPagarId: string;
  compraId: string;
  proveedorId: string;
  zafraId?: string;
  zafraNombre?: string | null;
  fecha: Date | string;
  moneda: "USD" | "PYG";
  monto: number;
  cuentaContableId: string;
  cuentaCajaBancoId?: string;
  referencia?: string;
  asientoId?: string;
  pagadoPor?: string;
  creadoEn?: Date | string | FieldValue;
};

export type TipoOperacionTesoreria = "ingreso" | "egreso" | "traspaso";
export type MedioMovimientoTesoreria = "transferencia" | "cheque" | "efectivo";

export type MovimientoTesoreria = {
  id: string;
  fecha: Date | string;
  tipoOperacion: TipoOperacionTesoreria;
  medio: MedioMovimientoTesoreria;
  moneda: "USD" | "PYG";
  monto: number;
  descripcion: string;
  zafraId?: string;
  zafraNombre?: string | null;
  referencia?: string;
  cuentaOrigenCajaBancoId?: string;
  cuentaOrigenContableId?: string;
  cuentaDestinoCajaBancoId?: string;
  cuentaDestinoContableId?: string;
  cuentaContrapartidaId?: string;
  asientoId?: string;
  creadoPor?: string;
  creadoEn?: Date | string | FieldValue;
};


export type Plaga = {
  id: string;
  nombre: string;
  descripcion: string;
  cultivosAfectados: string[];
};

export type EtapaCultivo = {
  id: string;
  nombre: string;
  cultivoId: string;
  orden: number;
  descripcion: string;
  diasDesdeSiembraInicio: number;
  diasDesdeSiembraFin: number;
};

// --- RRHH ---
export type Empleado = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: Date | string;
  fechaContratacion: Date | string;
  puesto: string;
  salario: number;
  estado: 'activo' | 'inactivo' | 'de vacaciones';
  telefono?: string;
  email?: string;
  direccion?: string;
};

export type Asistencia = {
  id: string;
  empleadoId: string;
  fecha: Date | string;
  horaEntrada: string; // "HH:mm"
  horaSalida: string; // "HH:mm"
  observaciones?: string;
};

export type TipoTrabajo = {
  id: string;
  nombre: string;
  activo?: boolean;
};

export type ControlHorario = {
    id: string;
    empleadoId: string;
    fecha: string;
    depositoId?: string;
    local?: string;
    tipoTrabajo?: string;
    precioHoraGs?: number;
    actividades: {
        parcelaId: string;
        horaInicio: string;
        horaFin: string;
        descripcion: string;
    }[];
};

export type PagoNominaHoras = {
  id: string;
  empleadoId: string;
  periodoAnio: number;
  periodoMes: number; // 1-12
  fechaPago: Date | string;
  moneda: "PYG";
  horasLiquidadas: number;
  monto: number;
  cuentaGastoId: string;
  cuentaCajaBancoId: string;
  cuentaCajaContableId: string;
  asientoId?: string;
  movimientoTesoreriaId?: string;
  reciboId?: string;
  observacion?: string;
  pagadoPor?: string;
  creadoEn?: Date | string | FieldValue;
};

export type ReciboPagoEmpleado = {
  id: string;
  numero: string;
  pagoNominaId: string;
  empleadoId: string;
  periodoAnio: number;
  periodoMes: number; // 1-12
  fecha: Date | string;
  moneda: "PYG";
  horasLiquidadas: number;
  monto: number;
  estado: "emitido" | "anulado";
  cuentaCajaBancoId: string;
  emitidoPor?: string;
  observacion?: string;
  creadoEn?: Date | string | FieldValue;
};


// --- CONTABILIDAD Y MAESTROS ---
export type PlanDeCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'costo' | 'gasto';
  naturaleza: 'deudora' | 'acreedora';
};

export type CentroDeCosto = {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: 'campo' | 'parcela' | 'cultivo' | 'maquinaria' | 'general';
};

export type AsientoDiario = {
  id: string;
  fecha: Date | string;
  descripcion: string;
  zafraId?: string;
  zafraNombre?: string | null;
  movimientos: {
    cuentaId: string;
    tipo: 'debe' | 'haber';
    monto: number;
    centroCostoId?: string;
  }[];
};


// --- NUEVOS MAESTROS ---

export type Deposito = {
  id: string;
  nombre: string;
  descripcion?: string;
  sucursalId?: string;
  activo: boolean;
};

export type Entidad = {
  id: string;
  tipo: "CLIENTE" | "PROVEEDOR" | "AMBOS";
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  activo: boolean;
};

export type CuentaCajaBanco = {
  id: string;
  nombre: string;
  tipo: "CAJA" | "BANCO" | "BILLETERA";
  monedaId: string;
  cuentaContableId?: string;
  activo: boolean;
};

export type CuentaContable = {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: string;
  activo: boolean;
};

export type Moneda = {
  id: string;
  codigo: string;
  descripcion: string;
  tasaCambio: number;
  esMonedaBase: boolean;
};

export type PlanFinanciacion = {
  id: string;
  nombre: string;
  cantidadCuotas: number;
  diasEntreCuotas: number;
};

export type TipoDocumento = {
  id: string;
  codigo: string;
  descripcion: string;
  esFiscal: boolean;
};

export type FormaPago = {
  id: string;
  codigo: string;
  descripcion: string;
};

// --- SaaS Comercial ---
export type ModeloCobroSaaS = "por_usuario" | "por_empresa";
export type PlanSaaS = "demo" | "basic" | "pro" | "enterprise";
export type EstadoSuscripcionSaaS = "trial" | "activa" | "vencida" | "suspendida";

export type EmpresaSaaS = {
  id: string;
  nombre: string;
  slug?: string;
  activo: boolean;
  perfil?: {
    razonSocial?: string;
    rubro?: string;
    ruc?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    ciudad?: string;
    pais?: string;
    contacto?: string;
    observaciones?: string;
  };
  branding?: {
    logoSrc?: string;
    preparedBy?: string;
    approvedBy?: string;
  };
  modulos?: Partial<Permisos>;
  demo: {
    habilitado: boolean;
    inicio?: Date | string;
    fin?: Date | string;
  };
  suscripcion: {
    estado: EstadoSuscripcionSaaS;
    plan: PlanSaaS;
    modeloCobro: ModeloCobroSaaS;
    moneda: "USD" | "PYG";
    montoMensual: number;
    maxUsuarios?: number | null;
    proximoCobro?: Date | string;
  };
  creadoEn?: Date | string | FieldValue;
  actualizadoEn?: Date | string | FieldValue;
};


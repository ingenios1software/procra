export type Parcela = {
  id: string;
  nombre: string;
  codigo: string;
  superficie: number;
  ubicacion: string;
  estado: 'activa' | 'inactiva' | 'en barbecho';
  sector?: string;
  numeroItem?: number;
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
  
  // Campos climáticos
  temperatura?: number;
  humedad?: number;
  viento?: number;

  // Campos para el panel agronómico y registro de insumos
  categoria?: 'Desecación' | 'Siembra' | 'Fertilizante' | 'Herbicida' | 'Fungicida' | 'Insecticida' | 'Cosecha' | 'Otros';
  productos?: {
    insumoId: string;
    insumo?: Insumo; // Objeto completo del insumo para fácil acceso
    cantidad: number;
    dosis: number;
    consumoCalculado?: number;
  }[];
  costoTotal?: number;
  hectareasAplicadas?: number;
  costoServicioPorHa?: number;


  // Campos de rendimiento y cosecha
  toneladas?: number;
  precioTonelada?: number;

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
  rol: UserRole;
  activo: boolean;
};

export type Rol = {
  id: string;
  nombre: UserRole;
  descripcion: string;
};

export type UserRole = 'admin' | 'operador' | 'consulta' | 'tecnicoCampo' | 'gerente' | 'auditor';

export type StatCard = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
};

export type Insumo = {
  id: string;
  nombre: string;
  categoria: 'fertilizante' | 'herbicida' | 'fungicida' | 'semilla' | 'insecticida' | 'biologico' | 'otros';
  principioActivo?: string;
  unidad: 'kg' | 'lt' | 'unidad' | 'ton';
  dosisRecomendada?: number;
  costoUnitario: number; // Costo de la última compra o manual
  precioPromedioCalculado?: number; // Calculado a partir de todas las compras
  stockMinimo: number;
  stockActual: number; // Este es el valor que se ajusta con entradas/salidas
  proveedor?: string;
  numeroItem?: number;
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
    fecha: Date;
    tipo: "salida" | "entrada" | "ajuste";
    origen: "evento" | "compra" | "ajuste manual";
    eventoId?: string;
    compraId?: string;
    ajusteId?: string;
    parcelaId?: string;
    parcelaNombre?: string;
    zafraId?: string;
    cultivo?: string;
    insumoId: string;
    insumoNombre: string;
    unidad: string;
    categoria: string;
    cantidad: number;
    stockAntes: number;
    stockDespues: number;
    precioUnitario: number;
    costoTotal: number;
    creadoPor: string;
    creadoEn: Date;
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
    cultivoId: string;
    parcelaId: string;
    zafraId: string;
    toneladas: number;
    precioTonelada: number;
    fecha: Date | string;
    clienteId?: string;
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
  fecha: Date | string;
  numeroDocumento: string;
  tipoDocumento: 'Factura' | 'Nota de Crédito' | 'Remisión';
  condicion: 'Contado' | 'Crédito';
  total: number;
  estado: 'Registrado' | 'Aprobado' | 'Pagado';
  items: {
    insumoId: string;
    cantidad: number;
    precioUnitario: number;
    porcentajeIva: '0' | '5' | '10';
  }[];
}

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


// --- CONTABILIDAD ---
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
  movimientos: {
    cuentaId: string;
    tipo: 'debe' | 'haber';
    monto: number;
    centroCostoId?: string;
  }[];
};

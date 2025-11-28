export type Parcela = {
  id: string;
  nombre: string;
  codigo: string;
  superficie: number;
  ubicacion: string;
  estado: 'activa' | 'inactiva' | 'en barbecho';
};

export type Cultivo = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type Zafra = {
  id:string;
  nombre: string;
  fechaInicio: Date;
  fechaFin?: Date;
  estado: 'planificada' | 'en curso' | 'finalizada';
  cultivoId?: string;
  fechaSiembra?: Date;
};

export type Evento = {
  id: string;
  parcelaId: string;
  cultivoId: string;
  zafraId: string;
  tipo: 'siembra' | 'fertilización' | 'riego' | 'cosecha' | 'mantenimiento' | 'plagas' | 'aplicacion' | 'rendimiento';
  fecha: Date;
  descripcion: string;
  resultado?: string;
  
  // Campos climáticos
  temperatura?: number;
  humedad?: number;
  viento?: number;

  // Campos para el panel agronómico y registro de insumos
  categoria?: 'Desecación' | 'Siembra' | 'Fertilizante' | 'Herbicida' | 'Fungicida' | 'Insecticida' | 'Cosecha' | 'Otros';
  productos?: {
    insumoId: string;
    cantidad: number;
    dosis: number;
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
  categoria: 'fertilizante' | 'herbicida' | 'fungicida' | 'semilla' | 'insecticida' | 'otros';
  principioActivo?: string;
  unidad: 'kg' | 'lt' | 'unidad';
  dosisRecomendada?: number;
  costoUnitario: number;
  stockMinimo: number;
  stockActual: number; // Este será el valor inicial de "entrada total"
  proveedor?: string;
};

export type MovimientoInsumo = {
  id: string;
  insumoId: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  fecha: Date;
  lote?: string;
  eventoId?: string;
};

export type Maquinaria = {
  id: string;
  nombre: string;
  tipo: 'tractor' | 'pulverizadora' | 'camioneta' | 'cosechadora' | 'otro';
  modelo?: string;
  año?: number;
  horasTrabajo: number;
  estado: 'operativa' | 'en mantenimiento' | 'fuera de servicio';
};

export type Mantenimiento = {
  id: string;
  maquinariaId: string;
  fecha: Date;
  tipo: 'cambio aceite' | 'filtro' | 'correas' | 'reparación' | 'otro';
  costo?: number;
  notas?: string;
};

export type Costo = {
    id: string;
    parcelaId: string;
    cultivoId?: string;
    zafraId: string;
    tipo: 'insumo' | 'maquinaria' | 'combustible' | 'mano de obra' | 'otros';
    descripcion: string;
    monto: number;
    fecha: Date;
};

export type Venta = {
    id: string;
    cultivoId: string;
    parcelaId: string;
    zafraId: string;
    toneladas: number;
    precioTonelada: number;
    fecha: Date;
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
};

export type Compra = {
  id: string;
  proveedorId: string;
  fecha: Date;
  numeroDocumento: string;
  tipoDocumento: 'Factura' | 'Nota de Crédito' | 'Remisión';
  condicion: 'Contado' | 'Crédito';
  total: number;
  estado: 'Registrado' | 'Aprobado' | 'Pagado';
  items: {
    insumoId: string;
    cantidad: number;
    precioUnitario: number;
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
  fechaNacimiento: Date;
  fechaContratacion: Date;
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
  fecha: Date;
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
  fecha: Date;
  descripcion: string;
  movimientos: {
    cuentaId: string;
    tipo: 'debe' | 'haber';
    monto: number;
    centroCostoId?: string;
  }[];
};

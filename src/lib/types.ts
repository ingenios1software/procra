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
};

export type Evento = {
  id: string;
  parcelaId: string;
  cultivoId: string;
  zafraId: string;
  tipo: 'siembra' | 'fertilización' | 'riego' | 'cosecha' | 'mantenimiento' | 'plagas';
  fecha: Date;
  descripcion: string;
  insumos?: string;
  cantidad?: number;
  unidad?: string;
  resultado?: string;
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
  categoria: 'fertilizante' | 'herbicida' | 'fungicida' | 'semilla' | 'otros';
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  proveedor?: string;
  costoUnitario?: number;
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
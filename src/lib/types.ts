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

export type UserRole = 'admin' | 'operador' | 'consulta';

export type StatCard = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
};

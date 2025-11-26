import { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, UserRole } from './types';

export const mockParcelas: Parcela[] = [
  { id: 'p1', nombre: 'Lote Norte 1', codigo: 'LN-001', superficie: 50, ubicacion: 'GPS: -34.5, -58.4', estado: 'activa' },
  { id: 'p2', nombre: 'Lote Sur 2', codigo: 'LS-002', superficie: 75, ubicacion: 'GPS: -34.6, -58.5', estado: 'en barbecho' },
  { id: 'p3', nombre: 'Lote Central', codigo: 'LC-001', superficie: 120, ubicacion: 'GPS: -34.55, -58.45', estado: 'activa' },
  { id: 'p4', nombre: 'Lote Este', codigo: 'LE-001', superficie: 30, ubicacion: 'GPS: -34.5, -58.4', estado: 'inactiva' },
];

export const mockCultivos: Cultivo[] = [
  { id: 'c1', nombre: 'Soja', descripcion: 'Variedad de ciclo corto, resistente a sequía.' },
  { id: 'c2', nombre: 'Maíz', descripcion: 'Híbrido de alto rinde para grano.' },
  { id: 'c3', nombre: 'Trigo', descripcion: 'Variedad panadera de invierno.' },
  { id: 'c4', nombre: 'Girasol', descripcion: 'Cultivo para producción de aceite.' },
];

export const mockZafras: Zafra[] = [
  { id: 'z1', nombre: 'Zafra 2023/2024', fechaInicio: new Date('2023-09-01'), fechaFin: new Date('2024-05-30'), estado: 'finalizada' },
  { id: 'z2', nombre: 'Zafra 2024/2025', fechaInicio: new Date('2024-09-01'), fechaFin: new Date('2025-08-31'), estado: 'en curso' },
  { id: 'z3', nombre: 'Zafra Invierno 2024', fechaInicio: new Date('2024-06-01'), fechaFin: new Date('2024-11-30'), estado: 'en curso' },
  { id: 'z4', nombre: 'Zafra 2025/2026', fechaInicio: new Date('2025-09-01'), fechaFin: new Date('2026-08-31'), estado: 'planificada' },
];

const generateEvent = (id: string, parcelaId: string, cultivoId: string, zafraId: string, tipo: Evento['tipo'], daysAgo: number, desc: string, insumos?: string, cantidad?: number, unidad?: string) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - daysAgo);
    return { id, parcelaId, cultivoId, zafraId, tipo, fecha, descripcion: desc, insumos, cantidad, unidad };
};

export const mockEventos: Evento[] = [
  generateEvent('e1', 'p1', 'c1', 'z2', 'siembra', 60, 'Siembra de Soja en Lote Norte 1.', 'Semillas Gen_V', 200, 'kg'),
  generateEvent('e2', 'p3', 'c2', 'z2', 'fertilización', 45, 'Aplicación de urea.', 'Urea', 500, 'kg'),
  generateEvent('e3', 'p1', 'c1', 'z2', 'riego', 35, 'Riego por aspersión.', undefined, 20, 'mm'),
  generateEvent('e4', 'p2', 'c3', 'z3', 'cosecha', 120, 'Cosecha de Trigo.', undefined, undefined, undefined),
  generateEvent('e5', 'p3', 'c2', 'z2', 'plagas', 5, 'Monitoreo de isoca.', 'Insecticida X', undefined, 'lt'),
  generateEvent('e6', 'p1', 'c1', 'z2', 'mantenimiento', 15, 'Limpieza de cabeceras.', undefined, undefined, undefined),
  generateEvent('e7', 'p2', 'c3', 'z3', 'siembra', 180, 'Siembra de Trigo de invierno', 'Semillas InviernoMax', 180, 'kg'),
  generateEvent('e8', 'p3', 'c2', 'z2', 'cosecha', 2, 'Cosecha de Maíz finalizada.', undefined, 7, 'ton/ha'),
  generateEvent('e9', 'p4', 'c4', 'z2', 'siembra', 40, 'Siembra de Girasol', 'Semillas SolAR', 80, 'kg'),
];

export const mockRoles: Rol[] = [
  { id: 'r1', nombre: 'admin', descripcion: 'Acceso completo a todas las funcionalidades del sistema.' },
  { id: 'r2', nombre: 'operador', descripcion: 'Puede crear y editar datos operativos, pero no gestionar usuarios o configuración.' },
  { id: 'r3', nombre: 'consulta', descripcion: 'Acceso de solo lectura a los datos del sistema.' },
];

export const mockUsuarios: Usuario[] = [
  { id: 'u1', nombre: 'Administrador Principal', email: 'admin@crapro95.com', rol: 'admin', activo: true },
  { id: 'u2', nombre: 'Juan Operario', email: 'juan.op@crapro95.com', rol: 'operador', activo: true },
  { id: 'u3', nombre: 'Ana Consulta', email: 'ana.con@crapro95.com', rol: 'consulta', activo: true },
  { id: 'u4', nombre: 'Carlos Inactivo', email: 'carlos.i@crapro95.com', rol: 'operador', activo: false },
];

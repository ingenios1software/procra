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
  { id: 'z2', nombre: 'Zafra 2024/2025', fechaInicio: new Date('2024-09-01'), estado: 'en curso' },
  { id: 'z3', nombre: 'Zafra Invierno 2024', fechaInicio: new Date('2024-06-01'), estado: 'en curso' },
  { id: 'z4', nombre: 'Zafra 2025/2026', fechaInicio: new Date('2025-09-01'), estado: 'planificada' },
];

export const mockEventos: Evento[] = [
  {
    id: 'e1', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'siembra', fecha: new Date('2024-10-15'),
    descripcion: 'Siembra de Soja en Lote Norte 1.', insumos: 'Semillas Gen_V', cantidad: 200, unidad: 'kg', resultado: 'Buena germinación'
  },
  {
    id: 'e2', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'fertilización', fecha: new Date('2024-11-01'),
    descripcion: 'Aplicación de urea.', insumos: 'Urea', cantidad: 500, unidad: 'kg', resultado: 'Niveles de N óptimos'
  },
  {
    id: 'e3', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'riego', fecha: new Date('2024-11-20'),
    descripcion: 'Riego por aspersión.', cantidad: 20, unidad: 'mm', resultado: 'Humedad de suelo recuperada'
  },
  {
    id: 'e4', parcelaId: 'p2', cultivoId: 'c3', zafraId: 'z3', tipo: 'cosecha', fecha: new Date('2024-07-05'),
    descripcion: 'Cosecha de Trigo.', resultado: 'Rinde de 4.5 ton/ha'
  },
  {
    id: 'e5', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'plagas', fecha: new Date(),
    descripcion: 'Monitoreo de isoca.', resultado: 'Baja incidencia'
  },
];

export const mockRoles: Rol[] = [
  { id: 'r1', nombre: 'admin', descripcion: 'Acceso completo a todas las funcionalidades de la aplicación.' },
  { id: 'r2', nombre: 'operador', descripcion: 'Puede crear y editar datos de la finca, pero no gestionar usuarios.' },
  { id: 'r3', nombre: 'consulta', descripcion: 'Solo tiene acceso de lectura a los datos de la aplicación.' },
];

export const mockUsuarios: Usuario[] = [
  { id: 'u1', nombre: 'Administrador Principal', email: 'admin@crapro95.com', rol: 'admin', activo: true },
  { id: 'u2', nombre: 'Juan Operario', email: 'juan.op@crapro95.com', rol: 'operador', activo: true },
  { id: 'u3', nombre: 'Ana Consulta', email: 'ana.con@crapro95.com', rol: 'consulta', activo: true },
  { id: 'u4', nombre: 'Carlos Inactivo', email: 'carlos.i@crapro95.com', rol: 'operador', activo: false },
];

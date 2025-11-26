import { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, UserRole, Insumo, Maquinaria, Mantenimiento, Costo, Venta, PlanDeCuenta, CentroDeCosto, AsientoDiario } from './types';

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
  { id: 'r4', nombre: 'gerente', descripcion: 'Visualización completa, incluyendo dashboards financieros.' },
  { id: 'r5', nombre: 'tecnicoCampo', descripcion: 'Puede cargar eventos, aplicaciones y adjuntar fotos.' },
  { id: 'r6', nombre: 'auditor', descripcion: 'Acceso total de solo lectura para auditorías.' },
];

export const mockUsuarios: Usuario[] = [
  { id: 'u1', nombre: 'Administrador Principal', email: 'admin@crapro95.com', rol: 'admin', activo: true },
  { id: 'u2', nombre: 'Juan Operario', email: 'juan.op@crapro95.com', rol: 'operador', activo: true },
  { id: 'u3', nombre: 'Ana Consulta', email: 'ana.con@crapro95.com', rol: 'consulta', activo: true },
  { id: 'u4', nombre: 'Carlos Inactivo', email: 'carlos.i@crapro95.com', rol: 'operador', activo: false },
  { id: 'u5', nombre: 'Gerente General', email: 'gerente@crapro95.com', rol: 'gerente', activo: true },
  { id: 'u6', nombre: 'Técnico de Campo', email: 'tecnico@crapro95.com', rol: 'tecnicoCampo', activo: true },
];

export const mockInsumos: Insumo[] = [
    { id: 'i1', nombre: 'Urea', categoria: 'fertilizante', unidad: 'kg', stockActual: 1500, stockMinimo: 500, proveedor: 'AgroPro', costoUnitario: 0.8 },
    { id: 'i2', nombre: 'Glifosato', categoria: 'herbicida', unidad: 'lt', stockActual: 200, stockMinimo: 50, proveedor: 'ChemCo', costoUnitario: 12.5 },
    { id: 'i3', nombre: 'Semillas de Soja DM 4800', categoria: 'semilla', unidad: 'kg', stockActual: 800, stockMinimo: 200, proveedor: 'SemillasSur', costoUnitario: 1.2 },
    { id: 'i4', nombre: 'Fungicida Triple', categoria: 'fungicida', unidad: 'lt', stockActual: 80, stockMinimo: 20, proveedor: 'ChemCo', costoUnitario: 25 },
];

export const mockMaquinarias: Maquinaria[] = [
    { id: 'm1', nombre: 'Tractor John Deere 7230J', tipo: 'tractor', modelo: '7230J', año: 2022, horasTrabajo: 1250, estado: 'operativa' },
    { id: 'm2', nombre: 'Pulverizadora Metalfor 3025', tipo: 'pulverizadora', modelo: '3025', año: 2021, horasTrabajo: 850, estado: 'operativa' },
    { id: 'm3', nombre: 'Cosechadora Case 8250', tipo: 'cosechadora', modelo: '8250', año: 2023, horasTrabajo: 600, estado: 'en mantenimiento' },
    { id: 'm4', nombre: 'Toyota Hilux 4x4', tipo: 'camioneta', modelo: 'Hilux', año: 2024, horasTrabajo: 400, estado: 'operativa' },
];

export const mockMantenimientos: Mantenimiento[] = [
    { id: 'mt1', maquinariaId: 'm1', fecha: new Date('2024-05-15'), tipo: 'cambio aceite', costo: 350, notas: 'Cambio de aceite y filtro de motor.' },
    { id: 'mt2', maquinariaId: 'm3', fecha: new Date(), tipo: 'reparación', costo: 1200, notas: 'Reparación de sistema hidráulico de plataforma.' },
];

export const mockCostos: Costo[] = [
    { id: 'cost1', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'insumo', descripcion: 'Compra de semillas de Soja', monto: 2400, fecha: new Date('2024-09-05') },
    { id: 'cost2', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'insumo', descripcion: 'Compra de Urea', monto: 4000, fecha: new Date('2024-09-10') },
    { id: 'cost3', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'combustible', descripcion: 'Combustible para siembra', monto: 1500, fecha: new Date('2024-09-06') },
    { id: 'cost4', parcelaId: 'p2', cultivoId: 'c3', zafraId: 'z3', tipo: 'mano de obra', descripcion: 'Mano de obra cosecha de trigo', monto: 3000, fecha: new Date('2024-07-20') },
    { id: 'cost5', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'maquinaria', descripcion: 'Alquiler de cosechadora', monto: 7500, fecha: new Date('2024-10-01') },
];

export const mockVentas: Venta[] = [
    { id: 'venta1', cultivoId: 'c3', parcelaId: 'p2', zafraId: 'z3', toneladas: 150, precioTonelada: 280, fecha: new Date('2024-08-01') },
    { id: 'venta2', cultivoId: 'c2', parcelaId: 'p3', zafraId: 'z2', toneladas: 840, precioTonelada: 310, fecha: new Date('2024-10-05') },
    { id: 'venta3', cultivoId: 'c1', parcelaId: 'p1', zafraId: 'z2', toneladas: 200, precioTonelada: 450, fecha: new Date('2024-11-15') },
];

export const mockPlanDeCuentas: PlanDeCuenta[] = [
  { id: '1', codigo: '1.01.01', nombre: 'Caja', tipo: 'activo', naturaleza: 'deudora' },
  { id: '2', codigo: '2.01.01', nombre: 'Proveedores', tipo: 'pasivo', naturaleza: 'acreedora' },
  { id: '3', codigo: '4.01.01', nombre: 'Venta de Granos', tipo: 'ingreso', naturaleza: 'acreedora' },
  { id: '4', codigo: '5.01.01', nombre: 'Costo de Insumos', tipo: 'costo', naturaleza: 'deudora' },
  { id: '5', codigo: '5.01.02', nombre: 'Costo de Combustible', tipo: 'costo', naturaleza: 'deudora' },
];

export const mockCentrosDeCosto: CentroDeCosto[] = [
  { id: 'cc1', nombre: 'Campo General', descripcion: 'Costos generales del establecimiento', categoria: 'campo' },
  { id: 'cc2', nombre: 'Lote Norte 1', descripcion: 'Costos asociados a la parcela LN-001', categoria: 'parcela' },
  { id: 'cc3', nombre: 'Cultivo Soja 24/25', descripcion: 'Costos del cultivo de Soja', categoria: 'cultivo' },
  { id: 'cc4', nombre: 'Tractor John Deere', descripcion: 'Costos de maquinaria', categoria: 'maquinaria' },
];

export const mockAsientosDiario: AsientoDiario[] = [
  {
    id: 'as1',
    fecha: new Date('2024-09-05'),
    descripcion: 'Compra de semillas de Soja',
    movimientos: [
      { cuentaId: '4', tipo: 'debe', monto: 2400, centroCostoId: 'cc3' },
      { cuentaId: '1', tipo: 'haber', monto: 2400 },
    ],
  },
  {
    id: 'as2',
    fecha: new Date('2024-08-01'),
    descripcion: 'Venta de cosecha de Trigo',
    movimientos: [
      { cuentaId: '1', tipo: 'debe', monto: 42000 },
      { cuentaId: '3', tipo: 'haber', monto: 42000, centroCostoId: 'cc2' },
    ],
  },
];

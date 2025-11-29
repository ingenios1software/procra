import { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, UserRole, Insumo, Maquinaria, Mantenimiento, Costo, Venta, PlanDeCuenta, CentroDeCosto, AsientoDiario, Proveedor, Cliente, Compra, Plaga, EtapaCultivo, Empleado, Asistencia } from './types';

export const mockParcelas: Parcela[] = [
  { id: 'p1', nombre: 'Lote Norte 1', codigo: 'LN-001', superficie: 50, ubicacion: 'GPS: -34.5, -58.4', estado: 'activa', sector: 'Norte' },
  { id: 'p2', nombre: 'Lote Sur 2', codigo: 'LS-002', superficie: 75, ubicacion: 'GPS: -34.6, -58.5', estado: 'activa', sector: 'Sur' },
  { id: 'p3', nombre: 'Lote Central', codigo: 'LC-001', superficie: 120, ubicacion: 'GPS: -34.55, -58.45', estado: 'activa', sector: 'Central' },
  { id: 'p4', nombre: 'Lote Este', codigo: 'LE-001', superficie: 30, ubicacion: 'inactiva', estado: 'inactiva', sector: 'Este' },
];

export const mockCultivos: Cultivo[] = [
  { id: 'c1', nombre: 'Soja', descripcion: 'Variedad de ciclo corto, resistente a sequía.' },
  { id: 'c2', nombre: 'Maíz', descripcion: 'Híbrido de alto rinde para grano.' },
  { id: 'c3', nombre: 'Trigo', descripcion: 'Variedad panadera de invierno.' },
  { id: 'c4', nombre: 'Girasol', descripcion: 'Cultivo para producción de aceite.' },
];

export const mockZafras: Zafra[] = [
  { id: 'z1', nombre: 'Zafra 2023/2024', fechaInicio: new Date('2023-09-01'), fechaFin: new Date('2024-05-30'), estado: 'finalizada' },
  { id: 'z2', nombre: 'Zafra Soja 2024/2025', cultivoId: 'c1', fechaSiembra: new Date(new Date().setDate(new Date().getDate() - 85)), fechaInicio: new Date('2024-09-01'), fechaFin: new Date('2025-08-31'), estado: 'en curso' },
  { id: 'z3', nombre: 'Zafra Maíz 2024/2025', cultivoId: 'c2', fechaSiembra: new Date(new Date().setDate(new Date().getDate() - 45)), fechaInicio: new Date('2024-06-01'), fechaFin: new Date('2024-11-30'), estado: 'en curso' },
  { id: 'z4', nombre: 'Zafra 2025/2026', fechaInicio: new Date('2025-09-01'), fechaFin: new Date('2026-08-31'), estado: 'planificada' },
];

export const mockInsumos: Insumo[] = [];

const generateEvent = (id: string, parcelaId: string, cultivoId: string, zafraId: string, tipo: Evento['tipo'], categoria: Evento['categoria'], daysAgo: number, desc: string, productos: Evento['productos'], extras: Partial<Evento> = {}) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - daysAgo);

    const costoTotal = productos?.reduce((sum, prod) => {
        const insumo = mockInsumos.find(i => i.id === prod.insumoId);
        return sum + (prod.cantidad * (insumo?.costoUnitario || 0));
    }, 0);

    return { id, parcelaId, cultivoId, zafraId, tipo, categoria, fecha, descripcion: desc, productos, costoTotal: costoTotal || extras.costoTotal || 0, ...extras };
};

export const mockEventos: Evento[] = [];


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

export const mockMaquinarias: Maquinaria[] = [
    { id: 'm1', nombre: 'Tractor John Deere 7230J', tipo: 'tractor', modelo: '7230J', año: 2022, horasTrabajo: 1250, estado: 'operativa' },
    { id: 'm2', nombre: 'Pulverizadora Metalfor 3025', tipo: 'pulverizadora', modelo: '3025', año: 2021, horasTrabajo: 850, estado: 'operativa' },
    { id: 'm3', nombre: 'Cosechadora Case 8250', tipo: 'cosechadora', modelo: '8250', año: 2023, horasTrabajo: 600, estado: 'en mantenimiento' },
    { id: 'm4', nombre: 'Toyota Hilux 4x4', tipo: 'camioneta', modelo: 'Hilux', año: 2024, horasTrabajo: 400, estado: 'operativa' },
];

export const mockMantenimientos: Mantenimiento[] = [
    { id: 'mt1', maquinariaId: 'm1', fecha: new Date('2024-05-15'), tipo: 'cambio aceite', costo: 350, notas: 'Cambio de aceite y filtro de motor.' },
    { id: 'mt2', maquinariaId: 'm3', fecha: new Date('2024-07-20'), tipo: 'reparación', costo: 1200, notas: 'Reparación de sistema hidráulico de plataforma.' },
];

export const mockCostos: Costo[] = [];

export const mockVentas: Venta[] = [];

export const mockPlanDeCuentas: PlanDeCuenta[] = [
  { id: '1', codigo: '1.01.01.001', nombre: 'Caja', tipo: 'activo', naturaleza: 'deudora' },
  { id: '2', codigo: '2.01.01.001', nombre: 'Proveedores Locales', tipo: 'pasivo', naturaleza: 'acreedora' },
  { id: '3', codigo: '4.01.01.001', nombre: 'Venta de Granos', tipo: 'ingreso', naturaleza: 'acreedora' },
  { id: '4', codigo: '5.01.01.001', nombre: 'Costo de Insumos Agrícolas', tipo: 'costo', naturaleza: 'deudora' },
  { id: '5', codigo: '5.01.02.001', nombre: 'Costo de Combustible', tipo: 'gasto', naturaleza: 'deudora' },
];

export const mockCentrosDeCosto: CentroDeCosto[] = [
  { id: 'cc1', nombre: 'Campo General', descripcion: 'Costos generales del establecimiento', categoria: 'campo' },
  { id: 'cc2', nombre: 'Lote Norte 1', descripcion: 'Costos asociados a la parcela LN-001', categoria: 'parcela' },
  { id: 'cc3', nombre: 'Cultivo Soja 24/25', descripcion: 'Costos del cultivo de Soja', categoria: 'cultivo' },
  { id: 'cc4', nombre: 'Tractor John Deere', descripcion: 'Costos de maquinaria', categoria: 'maquinaria' },
];

export const mockAsientosDiario: AsientoDiario[] = [];

export const mockProveedores: Proveedor[] = [
    { id: 'prov1', nombre: 'AgroPro S.A.', ruc: '80012345-1', direccion: 'Ruta 1 Km 50', telefono: '0981123456', email: 'ventas@agropro.com', activo: true, ciudad: 'Ypacaraí', pais: 'Paraguay', contacto: 'Juan Pérez' },
    { id: 'prov2', nombre: 'ChemCo Paraguay', ruc: '80054321-2', direccion: 'Av. Aviadores 1234', telefono: '021654321', email: 'info@chemco.com.py', activo: true, ciudad: 'Asunción', pais: 'Paraguay', contacto: 'María Gómez' },
    { id: 'prov3', nombre: 'Maquinarias S.R.L.', ruc: '80099887-3', activo: false, ciudad: 'CDE', pais: 'Paraguay' },
];

export const mockClientes: Cliente[] = [
    { id: 'cli1', nombre: 'Granos del Sur S.A.E.C.A.', ruc: '80098765-3', direccion: 'Puerto de Villeta', telefono: '0971987654', email: 'compras@granosdelsur.com', activo: true, ciudad: 'Villeta', pais: 'Paraguay', tipoCliente: 'acopiador' },
    { id: 'cli2', nombre: 'Aceitera Central S.A.', ruc: '80011223-4', direccion: 'Mariano R. Alonso', telefono: '021789456', email: 'acopio@aceiteracentral.com.py', activo: true, ciudad: 'Mariano R. Alonso', pais: 'Paraguay', tipoCliente: 'industria' },
];

export const mockCompras: Compra[] = [];

export const mockPlagas: Plaga[] = [
    { id: 'plaga1', nombre: 'Roya de la Soja', descripcion: 'Enfermedad fúngica causada por Phakopsora pachyrhizi.', cultivosAfectados: ['c1'] },
    { id: 'plaga2', nombre: 'Isoca de la Espiga', descripcion: 'Larva de la polilla Helicoverpa zea que ataca el maíz.', cultivosAfectados: ['c2'] },
    { id: 'plaga3', nombre: 'Pulgón del Trigo', descripcion: 'Insecto que se alimenta de la savia del trigo.', cultivosAfectados: ['c3'] },
];

export const mockEtapasCultivo: EtapaCultivo[] = [
    { id: 'ec1', cultivoId: 'c1', orden: 1, nombre: 'VE', descripcion: 'Emergencia', diasDesdeSiembraInicio: 0, diasDesdeSiembraFin: 7 },
    { id: 'ec2', cultivoId: 'c1', orden: 2, nombre: 'VC', descripcion: 'Cotiledones Desplegados', diasDesdeSiembraInicio: 8, diasDesdeSiembraFin: 14 },
    { id: 'ec3', cultivoId: 'c1', orden: 3, nombre: 'V1-Vn', descripcion: 'Desarrollo Vegetativo', diasDesdeSiembraInicio: 15, diasDesdeSiembraFin: 45 },
    { id: 'ec4', cultivoId: 'c1', orden: 4, nombre: 'R1-R2', descripcion: 'Inicio de Floración', diasDesdeSiembraInicio: 46, diasDesdeSiembraFin: 60 },
    { id: 'ec5', cultivoId: 'c1', orden: 5, nombre: 'R3-R4', descripcion: 'Formación de Vainas', diasDesdeSiembraInicio: 61, diasDesdeSiembraFin: 80 },
    { id: 'ec6', cultivoId: 'c1', orden: 6, nombre: 'R5-R6', descripcion: 'Llenado de Granos', diasDesdeSiembraInicio: 81, diasDesdeSiembraFin: 110 },
    { id: 'ec7', cultivoId: 'c1', orden: 7, nombre: 'R7-R8', descripcion: 'Madurez Fisiológica y de Cosecha', diasDesdeSiembraInicio: 111, diasDesdeSiembraFin: 130 },
    { id: 'ec8', cultivoId: 'c2', orden: 1, nombre: 'VE-V3', descripcion: 'Implantación', diasDesdeSiembraInicio: 0, diasDesdeSiembraFin: 15 },
    { id: 'ec9', cultivoId: 'c2', orden: 2, nombre: 'V4-V8', descripcion: 'Definición de Potencial de Rinde', diasDesdeSiembraInicio: 16, diasDesdeSiembraFin: 40 },
    { id: 'ec10', cultivoId: 'c2', orden: 3, nombre: 'VT-R1', descripcion: 'Panojamiento y Floración', diasDesdeSiembraInicio: 41, diasDesdeSiembraFin: 60 },
    { id: 'ec11', cultivoId: 'c2', orden: 4, nombre: 'R2-R6', descripcion: 'Llenado de Granos', diasDesdeSiembraInicio: 61, diasDesdeSiembraFin: 120 },
];

export const mockEmpleados: Empleado[] = [
    { id: 'emp1', nombre: 'Carlos', apellido: 'Gomez', documento: '4.587.985', fechaNacimiento: new Date('1990-05-15'), fechaContratacion: new Date('2020-03-01'), puesto: 'Operador de Maquinaria', salario: 3500000, estado: 'activo' },
    { id: 'emp2', nombre: 'Lucía', apellido: 'Fernandez', documento: '5.123.456', fechaNacimiento: new Date('1995-11-22'), fechaContratacion: new Date('2021-07-15'), puesto: 'Técnico de Campo', salario: 4500000, estado: 'activo' },
    { id: 'emp3', nombre: 'Miguel', apellido: 'Benitez', documento: '3.987.654', fechaNacimiento: new Date('1985-01-30'), fechaContratacion: new Date('2018-01-10'), puesto: 'Jefe de Campo', salario: 7000000, estado: 'de vacaciones' },
    { id: 'emp4', nombre: 'Elena', apellido: 'Ramirez', documento: '6.321.987', fechaNacimiento: new Date('2000-08-10'), fechaContratacion: new Date('2023-02-20'), puesto: 'Asistente Administrativo', salario: 2800000, estado: 'inactivo' },
];

export const mockAsistencias: Asistencia[] = [
    { id: 'asist1', empleadoId: 'emp1', fecha: new Date(new Date().setDate(new Date().getDate() - 1)), horaEntrada: '07:00', horaSalida: '17:00' },
    { id: 'asist2', empleadoId: 'emp2', fecha: new Date(new Date().setDate(new Date().getDate() - 1)), horaEntrada: '07:30', horaSalida: '17:30' },
    { id: 'asist3', empleadoId: 'emp1', fecha: new Date(new Date().setDate(new Date().getDate() - 2)), horaEntrada: '07:05', horaSalida: '17:03' },
    { id: 'asist4', empleadoId: 'emp4', fecha: new Date(new Date().setDate(new Date().getDate() - 2)), horaEntrada: '08:00', horaSalida: '12:00', observaciones: 'Media jornada' },
];

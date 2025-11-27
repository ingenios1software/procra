import { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, UserRole, Insumo, Maquinaria, Mantenimiento, Costo, Venta, PlanDeCuenta, CentroDeCosto, AsientoDiario, Proveedor, Cliente, Compra, Plaga, EtapaCultivo, Empleado, Asistencia } from './types';

export const mockParcelas: Parcela[] = [
  { id: 'p1', nombre: 'Lote Norte 1', codigo: 'LN-001', superficie: 50, ubicacion: 'GPS: -34.5, -58.4', estado: 'activa' },
  { id: 'p2', nombre: 'Lote Sur 2', codigo: 'LS-002', superficie: 75, ubicacion: 'GPS: -34.6, -58.5', estado: 'activa' },
  { id: 'p3', nombre: 'Lote Central', codigo: 'LC-001', superficie: 120, ubicacion: 'GPS: -34.55, -58.45', estado: 'activa' },
  { id: 'p4', nombre: 'Lote Este', codigo: 'LE-001', superficie: 30, ubicacion: 'inactiva', estado: 'inactiva' },
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

export const mockInsumos: Insumo[] = [
    { id: 'i1', nombre: 'Urea', categoria: 'fertilizante', unidad: 'kg', stockActual: 1500, stockMinimo: 500, proveedor: 'AgroPro S.A.', costoUnitario: 0.8 },
    { id: 'i2', nombre: 'Glifosato', categoria: 'herbicida', unidad: 'lt', stockActual: 200, stockMinimo: 50, proveedor: 'ChemCo Paraguay', costoUnitario: 12.5 },
    { id: 'i3', nombre: 'Semillas de Soja DM 4800', categoria: 'semilla', unidad: 'kg', stockActual: 800, stockMinimo: 200, proveedor: 'AgroPro S.A.', costoUnitario: 1.2 },
    { id: 'i4', nombre: 'Fungicida Triple', categoria: 'fungicida', unidad: 'lt', stockActual: 80, stockMinimo: 20, proveedor: 'ChemCo Paraguay', costoUnitario: 25 },
    { id: 'i5', nombre: 'Insecticida Cipermetrina', categoria: 'insecticida', unidad: 'lt', stockActual: 120, stockMinimo: 30, proveedor: 'ChemCo Paraguay', costoUnitario: 18 },
    { id: 'i6', nombre: 'Fosfato Diamónico (DAP)', categoria: 'fertilizante', unidad: 'kg', stockActual: 2500, stockMinimo: 1000, proveedor: 'AgroPro S.A.', costoUnitario: 0.95 },
    { id: 'i7', nombre: 'Semillas de Maíz DK 72-10', categoria: 'semilla', unidad: 'kg', stockActual: 5000, stockMinimo: 1000, proveedor: 'AgroPro S.A.', costoUnitario: 2.5 },
];

const generateEvent = (id: string, parcelaId: string, cultivoId: string, zafraId: string, tipo: Evento['tipo'], categoria: Evento['categoria'], daysAgo: number, desc: string, productos: Evento['productos'], extras: Partial<Evento> = {}) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - daysAgo);

    const costoTotal = productos?.reduce((sum, prod) => {
        const insumo = mockInsumos.find(i => i.id === prod.insumoId);
        return sum + (prod.cantidad * (insumo?.costoUnitario || 0));
    }, 0);

    return { id, parcelaId, cultivoId, zafraId, tipo, categoria, fecha, descripcion: desc, productos, costoTotal: costoTotal || extras.costoTotal || 0, ...extras };
};

export const mockEventos: Evento[] = [
  // --- Parcela 1 (Soja) ---
  generateEvent('ev1', 'p1', 'c1', 'z2', 'aplicacion', 'Desecación', 85, 'Desecación pre-siembra', [{ insumoId: 'i2', cantidad: 100, dosis: 2 }]),
  generateEvent('ev2', 'p1', 'c1', 'z2', 'siembra', 'Siembra', 82, 'Siembra de Soja', [{ insumoId: 'i3', cantidad: 4000, dosis: 80 }]),
  generateEvent('ev3', 'p1', 'c1', 'z2', 'aplicacion', 'Herbicida', 60, 'Herbicida pre-emergente', [{ insumoId: 'i2', cantidad: 50, dosis: 1 }]),
  generateEvent('ev4', 'p1', 'c1', 'z2', 'fertilización', 'Fertilizante', 55, 'Fertilización base con DAP', [{ insumoId: 'i6', cantidad: 7500, dosis: 150 }]),
  generateEvent('ev5', 'p1', 'c1', 'z2', 'aplicacion', 'Insecticida', 30, 'Control de insectos', [{ insumoId: 'i5', cantidad: 25, dosis: 0.5 }]),
  generateEvent('ev6', 'p1', 'c1', 'z2', 'aplicacion', 'Fungicida', 15, 'Aplicación de fungicida preventivo', [{ insumoId: 'i4', cantidad: 50, dosis: 1 }]),
  generateEvent('ev7', 'p1', 'c1', 'z2', 'rendimiento', 'Cosecha', 2, 'Cosecha Lote Norte 1', [], { toneladas: 180 }), // 3600 kg/ha

  // --- Parcela 2 (Soja) ---
  generateEvent('ev8', 'p2', 'c1', 'z2', 'aplicacion', 'Desecación', 90, 'Desecación pre-siembra', [{ insumoId: 'i2', cantidad: 150, dosis: 2 }]),
  generateEvent('ev9', 'p2', 'c1', 'z2', 'siembra', 'Siembra', 88, 'Siembra de Soja', [{ insumoId: 'i3', cantidad: 6000, dosis: 80 }]),
  generateEvent('ev10', 'p2', 'c1', 'z2', 'fertilización', 'Fertilizante', 70, 'Fertilización base con DAP', [{ insumoId: 'i6', cantidad: 12000, dosis: 160 }]),
  generateEvent('ev11', 'p2', 'c1', 'z2', 'aplicacion', 'Fungicida', 20, 'Aplicación de fungicida preventivo', [{ insumoId: 'i4', cantidad: 75, dosis: 1 }]),
  generateEvent('ev12', 'p2', 'c1', 'z2', 'rendimiento', 'Cosecha', 3, 'Cosecha Lote Sur 2', [], { toneladas: 315 }), // 4200 kg/ha

  // --- Parcela 3 (Maíz) ---
  generateEvent('ev13', 'p3', 'c2', 'z3', 'siembra', 'Siembra', 45, 'Siembra de Maíz', [{ insumoId: 'i7', cantidad: 2400, dosis: 20 }]),
  generateEvent('ev14', 'p3', 'c2', 'z3', 'fertilización', 'Fertilizante', 30, 'Fertilización Nitrogenada', [{ insumoId: 'i1', cantidad: 24000, dosis: 200 }]),
  generateEvent('ev15', 'p3', 'c2', 'z3', 'aplicacion', 'Herbicida', 25, 'Control de malezas', [{ insumoId: 'i2', cantidad: 120, dosis: 1 }]),
  generateEvent('ev16', 'p3', 'c2', 'z3', 'rendimiento', 'Cosecha', 5, 'Cosecha Lote Central', [], { toneladas: 900 }), // 7500 kg/ha
  
  // --- Eventos Generales / Otros ---
  generateEvent('ev17', 'p2', 'c1', 'z2', 'mantenimiento', 'Otros', 40, 'Reparación de alambrado perimetral', [], { costoTotal: 500 }),
  generateEvent('ev18', 'p1', 'c1', 'z2', 'plagas', 'Insecticida', 10, 'Monitoreo y control de chinches', [{ insumoId: 'i5', cantidad: 30, dosis: 0.6 }]),
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

export const mockCostos: Costo[] = [
    { id: 'cost1', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'insumo', descripcion: 'Compra de semillas de Soja', monto: 2400, fecha: new Date('2024-09-05') },
    { id: 'cost2', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'insumo', descripcion: 'Compra de Urea', monto: 4000, fecha: new Date('2024-09-10') },
    { id: 'cost3', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z2', tipo: 'combustible', descripcion: 'Combustible para siembra', monto: 1500, fecha: new Date('2024-09-06') },
    { id: 'cost4', parcelaId: 'p2', cultivoId: 'c3', zafraId: 'z3', tipo: 'mano de obra', descripcion: 'Mano de obra cosecha de trigo', monto: 3000, fecha: new Date('2024-07-20') },
    { id: 'cost5', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'maquinaria', descripcion: 'Alquiler de cosechadora', monto: 7500, fecha: new Date('2024-10-01') },
];

export const mockVentas: Venta[] = [
    { id: 'venta1', cultivoId: 'c3', parcelaId: 'p2', zafraId: 'z3', toneladas: 150, precioTonelada: 280, fecha: new Date('2024-08-01'), clienteId: 'cli1' },
    { id: 'venta2', cultivoId: 'c2', parcelaId: 'p3', zafraId: 'z2', toneladas: 840, precioTonelada: 310, fecha: new Date('2024-10-05'), clienteId: 'cli2' },
    { id: 'venta3', cultivoId: 'c1', parcelaId: 'p1', zafraId: 'z2', toneladas: 200, precioTonelada: 450, fecha: new Date('2024-11-15'), clienteId: 'cli1' },
];

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

export const mockProveedores: Proveedor[] = [
    { id: 'prov1', nombre: 'AgroPro S.A.', ruc: '80012345-1', direccion: 'Ruta 1 Km 50', telefono: '0981123456', email: 'ventas@agropro.com', activo: true, ciudad: 'Ypacaraí', pais: 'Paraguay', contacto: 'Juan Pérez' },
    { id: 'prov2', nombre: 'ChemCo Paraguay', ruc: '80054321-2', direccion: 'Av. Aviadores 1234', telefono: '021654321', email: 'info@chemco.com.py', activo: true, ciudad: 'Asunción', pais: 'Paraguay', contacto: 'María Gómez' },
    { id: 'prov3', nombre: 'Maquinarias S.R.L.', ruc: '80099887-3', activo: false, ciudad: 'CDE', pais: 'Paraguay' },
];

export const mockClientes: Cliente[] = [
    { id: 'cli1', nombre: 'Granos del Sur S.A.E.C.A.', ruc: '80098765-3', direccion: 'Puerto de Villeta', telefono: '0971987654', email: 'compras@granosdelsur.com', activo: true, ciudad: 'Villeta', pais: 'Paraguay', tipoCliente: 'acopiador' },
    { id: 'cli2', nombre: 'Aceitera Central S.A.', ruc: '80011223-4', direccion: 'Mariano R. Alonso', telefono: '021789456', email: 'acopio@aceiteracentral.com.py', activo: true, ciudad: 'Mariano R. Alonso', pais: 'Paraguay', tipoCliente: 'industria' },
];

export const mockCompras: Compra[] = [
    { id: 'comp1', proveedorId: 'prov1', fecha: new Date('2024-10-01'), numeroDocumento: '001-001-001234', tipoDocumento: 'Factura', condicion: 'Crédito', total: 1500, estado: 'Aprobado', items: [{ insumoId: 'i1', cantidad: 1000, precioUnitario: 1.5 }] },
    { id: 'comp2', proveedorId: 'prov2', fecha: new Date('2024-10-05'), numeroDocumento: '001-002-005678', tipoDocumento: 'Factura', condicion: 'Contado', total: 2500, estado: 'Pagado', items: [{ insumoId: 'i2', cantidad: 200, precioUnitario: 12.5 }] },
];

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

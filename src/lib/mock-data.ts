
import { Parcela, Cultivo, Zafra, Evento, Usuario, UserRole, Rol, Insumo, Maquinaria, Costo, Venta, Proveedor, Cliente, Compra, Plaga, EtapaCultivo, Empleado, Asistencia, PlanDeCuenta, CentroDeCosto, AsientoDiario } from './types';
import { addDays, subDays } from 'date-fns';

const today = new Date();

export const initialParcelas: Parcela[] = [
  { id: 'p1', nombre: 'Lote Norte 1', codigo: 'LN-001', superficie: 50, ubicacion: '25.3S 57.6W', estado: 'activa', sector: 'Norte' },
  { id: 'p2', nombre: 'Lote Sur 2', codigo: 'LS-002', superficie: 75, ubicacion: '25.4S 57.5W', estado: 'en barbecho', sector: 'Sur' },
  { id: 'p3', nombre: 'Lote Este 3', codigo: 'LE-003', superficie: 100, ubicacion: '25.3S 57.4W', estado: 'activa', sector: 'Este' },
];

export const initialCultivos: Cultivo[] = [
  { id: 'c1', nombre: 'Soja', descripcion: 'Soja RR de ciclo corto' },
  { id: 'c2', nombre: 'Maíz', descripcion: 'Maíz para grano' },
  { id: 'c3', nombre: 'Trigo', descripcion: 'Trigo para panificación' },
];

export const initialZafras: Zafra[] = [
  { id: 'z1', nombre: 'Soja 23/24', fechaInicio: subDays(today, 150), fechaFin: addDays(today, 30), estado: 'en curso', cultivoId: 'c1', fechaSiembra: subDays(today, 120) },
  { id: 'z2', nombre: 'Maíz Zafriña 2024', fechaInicio: subDays(today, 60), fechaFin: addDays(today, 90), estado: 'planificada', cultivoId: 'c2' },
  { id: 'z3', nombre: 'Trigo Invierno 2023', fechaInicio: subDays(today, 300), fechaFin: subDays(today, 150), estado: 'finalizada', cultivoId: 'c3' },
];

export const initialEventos: Evento[] = [
  { id: 'e1', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z1', tipo: 'siembra', fecha: subDays(today, 120), descripcion: 'Siembra de soja', categoria: 'Siembra', productos: [{insumoId: 'i1', dosis: 100, cantidad: 5000}], costoTotal: 7500 },
  { id: 'e2', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z1', tipo: 'fertilización', fecha: subDays(today, 90), descripcion: 'Aplicación de NPK', categoria: 'Fertilizante', productos: [{insumoId: 'i2', dosis: 150, cantidad: 7500}], costoTotal: 11250 },
  { id: 'e3', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z1', tipo: 'aplicacion', fecha: subDays(today, 60), descripcion: 'Control de malezas', categoria: 'Herbicida', productos: [{insumoId: 'i3', dosis: 2, cantidad: 100}], costoTotal: 2500 },
  { id: 'e4', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'siembra', fecha: subDays(today, 45), descripcion: 'Siembra de maíz zafriña', categoria: 'Siembra', productos: [{insumoId: 'i4', dosis: 25, cantidad: 2500}], costoTotal: 10000 },
  { id: 'e5', parcelaId: 'p3', cultivoId: 'c2', zafraId: 'z2', tipo: 'plagas', fecha: subDays(today, 20), descripcion: 'Control de pulgones', categoria: 'Insecticida', productos: [{insumoId: 'i5', dosis: 0.5, cantidad: 50}], costoTotal: 3000 },
  { id: 'e6', parcelaId: 'p1', cultivoId: 'c1', zafraId: 'z1', tipo: 'aplicacion', fecha: subDays(today, 15), descripcion: 'Aplicación de fungicida preventivo', categoria: 'Fungicida', productos: [{insumoId: 'i6', dosis: 1, cantidad: 50}], costoTotal: 4500},
];

export const initialUsuarios: Usuario[] = [
    { id: 'u1', nombre: 'Admin CRApro', email: 'admin@crapro95.com', rol: 'admin', activo: true },
    { id: 'u2', nombre: 'Gerente Campo', email: 'gerente@crapro95.com', rol: 'gerente', activo: true },
    { id: 'u3', nombre: 'Operador Maquina', email: 'operador@crapro95.com', rol: 'operador', activo: true },
    { id: 'u4', nombre: 'Técnico Agrónomo', email: 'tecnico@crapro95.com', rol: 'tecnicoCampo', activo: true },
    { id: 'u5', nombre: 'Auditor Externo', email: 'auditor@crapro95.com', rol: 'auditor', activo: false },
    { id: 'u6', nombre: 'Usuario Consulta', email: 'consulta@crapro95.com', rol: 'consulta', activo: true },
];

export const initialRoles: Rol[] = [
    { id: 'r1', nombre: 'admin', descripcion: 'Acceso total al sistema.' },
    { id: 'r2', nombre: 'gerente', descripcion: 'Acceso a dashboards y reportes.' },
    { id: 'r3', nombre: 'operador', descripcion: 'Registro de eventos y actividades.' },
    { id: 'r4', nombre: 'tecnicoCampo', descripcion: 'Gestión de agronomía y sanidad.' },
    { id: 'r5', nombre: 'auditor', descripcion: 'Acceso de solo lectura a todos los registros.' },
    { id: 'r6', nombre: 'consulta', descripcion: 'Acceso limitado a consultas específicas.' },
];

export const initialInsumos: Insumo[] = [
    {id: 'i1', nombre: 'Semilla de Soja DM 5958', categoria: 'semilla', unidad: 'kg', costoUnitario: 1.2, stockMinimo: 1000, stockActual: 5000, proveedor: 'Agrofértil'},
    {id: 'i2', nombre: 'Fertilizante NPK 12-24-12', categoria: 'fertilizante', unidad: 'kg', costoUnitario: 0.8, stockMinimo: 2000, stockActual: 10000, proveedor: 'Yara'},
    {id: 'i3', nombre: 'Glifosato 48%', categoria: 'herbicida', principioActivo: 'Glifosato', unidad: 'lt', costoUnitario: 4.5, stockMinimo: 50, stockActual: 200, proveedor: 'Syngenta'},
    {id: 'i4', nombre: 'Semilla de Maíz P30F35', categoria: 'semilla', unidad: 'kg', costoUnitario: 2.5, stockMinimo: 500, stockActual: 2000, proveedor: 'Pioneer'},
    {id: 'i5', nombre: 'Imidacloprid 35%', categoria: 'insecticida', principioActivo: 'Imidacloprid', unidad: 'lt', costoUnitario: 15, stockMinimo: 20, stockActual: 100, proveedor: 'Bayer'},
    {id: 'i6', nombre: 'Tebuconazole + Triazol', categoria: 'fungicida', principioActivo: 'Tebuconazole', unidad: 'lt', costoUnitario: 22, stockMinimo: 30, stockActual: 150, proveedor: 'BASF'},
];

export const initialMaquinaria: Maquinaria[] = [
    {id: 'm1', nombre: 'John Deere 7230J', tipo: 'tractor', modelo: '7230J', año: 2022, horasTrabajo: 1250, estado: 'operativa' },
    {id: 'm2', nombre: 'Case IH 8250', tipo: 'cosechadora', modelo: 'Axial-Flow 8250', año: 2021, horasTrabajo: 850, estado: 'operativa' },
    {id: 'm3', nombre: 'Stara Imperador 3.0', tipo: 'pulverizadora', modelo: 'Imperador 3.0', año: 2023, horasTrabajo: 450, estado: 'en mantenimiento' },
    {id: 'm4', nombre: 'Toyota Hilux 2022', tipo: 'camioneta', modelo: 'Hilux 4x4', año: 2022, horasTrabajo: 0, estado: 'operativa' },
];

export const initialCostos: Costo[] = [
    {id: 'co1', parcelaId: 'p1', zafraId: 'z1', cultivoId: 'c1', tipo: 'insumo', descripcion: 'Compra de semillas de Soja', monto: 6000, fecha: subDays(today, 125)},
    {id: 'co2', parcelaId: 'p1', zafraId: 'z1', cultivoId: 'c1', tipo: 'insumo', descripcion: 'Compra de fertilizantes NPK', monto: 8000, fecha: subDays(today, 95)},
    {id: 'co3', parcelaId: 'p1', zafraId: 'z1', cultivoId: 'c1', tipo: 'maquinaria', descripcion: 'Combustible para siembra', monto: 1200, fecha: subDays(today, 120)},
    {id: 'co4', parcelaId: 'p3', zafraId: 'z2', cultivoId: 'c2', tipo: 'insumo', descripcion: 'Compra de semillas de Maíz', monto: 5000, fecha: subDays(today, 50)},
    {id: 'co5', parcelaId: 'p3', zafraId: 'z2', cultivoId: 'c2', tipo: 'mano de obra', descripcion: 'Pago a operador', monto: 700, fecha: subDays(today, 20)},
];

export const initialVentas: Venta[] = [
    {id: 'v1', cultivoId: 'c3', parcelaId: 'p2', zafraId: 'z3', toneladas: 350, precioTonelada: 250, fecha: subDays(today, 160), clienteId: 'cl1'},
    {id: 'v2', cultivoId: 'c3', parcelaId: 'p2', zafraId: 'z3', toneladas: 150, precioTonelada: 255, fecha: subDays(today, 155), clienteId: 'cl2'},
];

export const initialProveedores: Proveedor[] = [];
export const initialClientes: Cliente[] = [
    {id: 'cl1', nombre: 'Cargill', ruc: '80012345-1', activo: true},
    {id: 'cl2', nombre: 'ADM', ruc: '80054321-2', activo: true},
];
export const initialCompras: Compra[] = [];

export const initialPlagas: Plaga[] = [
    { id: 'pl1', nombre: 'Roya de la Soja', descripcion: 'Phakopsora pachyrhizi, hongo que afecta las hojas.', cultivosAfectados: ['c1'] },
    { id: 'pl2', nombre: 'Pulgón del Maíz', descripcion: 'Rhopalosiphum maidis, insecto chupador.', cultivosAfectados: ['c2'] },
];

export const initialEtapasCultivo: EtapaCultivo[] = [
    { id: 'ec1', cultivoId: 'c1', orden: 1, nombre: 'VE', descripcion: 'Emergencia', diasDesdeSiembraInicio: 0, diasDesdeSiembraFin: 5 },
    { id: 'ec2', cultivoId: 'c1', orden: 2, nombre: 'V1', descripcion: 'Primer nudo', diasDesdeSiembraInicio: 6, diasDesdeSiembraFin: 15 },
    { id: 'ec3', cultivoId: 'c1', orden: 3, nombre: 'V3', descripcion: 'Tercer nudo', diasDesdeSiembraInicio: 16, diasDesdeSiembraFin: 30 },
    { id: 'ec4', cultivoId: 'c1', orden: 4, nombre: 'R1', descripcion: 'Inicio Floración', diasDesdeSiembraInicio: 31, diasDesdeSiembraFin: 45 },
    { id: 'ec5', cultivoId: 'c1', orden: 5, nombre: 'R3', descripcion: 'Inicio Formación Vainas', diasDesdeSiembraInicio: 46, diasDesdeSiembraFin: 60 },
    { id: 'ec6', cultivoId: 'c1', orden: 6, nombre: 'R5', descripcion: 'Inicio Llenado de Granos', diasDesdeSiembraInicio: 61, diasDesdeSiembraFin: 90 },
    { id: 'ec7', cultivoId: 'c1', orden: 7, nombre: 'R8', descripcion: 'Madurez Plena', diasDesdeSiembraInicio: 91, diasDesdeSiembraFin: 120 },
];

export const initialEmpleados: Empleado[] = [];
export const initialAsistencias: Asistencia[] = [];

export const initialPlanDeCuentas: PlanDeCuenta[] = [];
export const initialCentrosDeCosto: CentroDeCosto[] = [];
export const initialAsientosDiario: AsientoDiario[] = [];

// En el archivo original, parcelas tiene la propiedad tieneEventosRecientes, la agrego
initialParcelas.forEach(p => {
  (p as any).tieneEventosRecientes = initialEventos.some(e => e.parcelaId === p.id && subDays(today, 30) < new Date(e.fecha));
});

    
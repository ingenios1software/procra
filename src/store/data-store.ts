import { create } from 'zustand';
import {
  mockParcelas,
  mockCultivos,
  mockZafras,
  mockEventos,
  mockInsumos,
  mockMaquinarias,
  mockCostos,
  mockVentas,
  mockPlanDeCuentas,
  mockCentrosDeCosto,
  mockAsientosDiario,
  mockProveedores,
  mockClientes,
  mockCompras,
  mockPlagas,
  mockEtapasCultivo,
  mockEmpleados,
  mockAsistencias,
} from '@/lib/mock-data';
import type {
  Parcela,
  Cultivo,
  Zafra,
  Evento,
  Insumo,
  Maquinaria,
  Costo,
  Venta,
  PlanDeCuenta,
  CentroDeCosto,
  AsientoDiario,
  Proveedor,
  Cliente,
  Compra,
  Plaga,
  EtapaCultivo,
  Empleado,
  Asistencia
} from '@/lib/types';

interface DataState {
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  eventos: Evento[];
  insumos: Insumo[];
  maquinarias: Maquinaria[];
  costos: Costo[];
  ventas: Venta[];
  planDeCuentas: PlanDeCuenta[];
  centrosDeCosto: CentroDeCosto[];
  asientosDiario: AsientoDiario[];
  proveedores: Proveedor[];
  clientes: Cliente[];
  compras: Compra[];
  plagas: Plaga[];
  etapasCultivo: EtapaCultivo[];
  empleados: Empleado[];
  asistencias: Asistencia[];
  addZafra: (zafra: Omit<Zafra, 'id'>) => void;
  updateZafra: (zafra: Zafra) => void;
  addEvento: (evento: Omit<Evento, 'id'>) => void;
  updateEvento: (evento: Evento) => void;
}

export const useDataStore = create<DataState>((set) => ({
  parcelas: mockParcelas,
  cultivos: mockCultivos,
  zafras: mockZafras,
  eventos: mockEventos,
  insumos: mockInsumos,
  maquinarias: mockMaquinarias,
  costos: mockCostos,
  ventas: mockVentas,
  planDeCuentas: mockPlanDeCuentas,
  centrosDeCosto: mockCentrosDeCosto,
  asientosDiario: mockAsientosDiario,
  proveedores: mockProveedores,
  clientes: mockClientes,
  compras: mockCompras,
  plagas: mockPlagas,
  etapasCultivo: mockEtapasCultivo,
  empleados: mockEmpleados,
  asistencias: mockAsistencias,

  addZafra: (zafra) =>
    set((state) => ({
      zafras: [...state.zafras, { ...zafra, id: `z${Date.now()}` }],
    })),
  
  updateZafra: (zafra) =>
    set((state) => ({
      zafras: state.zafras.map((z) => (z.id === zafra.id ? zafra : z)),
    })),
  
  addEvento: (evento) =>
    set((state) => ({
      eventos: [...state.eventos, { ...evento, id: `ev${Date.now()}` }],
    })),

  updateEvento: (evento) =>
    set((state) => ({
      eventos: state.eventos.map((e) => (e.id === evento.id ? evento : e)),
    })),

}));

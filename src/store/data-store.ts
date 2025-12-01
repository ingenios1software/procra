import { create } from 'zustand';
import type { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, Insumo, Maquinaria, Costo, Venta, Proveedor, Cliente, Compra, Plaga, EtapaCultivo, Empleado, Asistencia, PlanDeCuenta, CentroDeCosto, AsientoDiario } from '@/lib/types';
import { produce } from 'immer';

interface DataState {
  // Ya no se usan los datos mock, pero se mantiene la estructura por si se necesita en el futuro para testing.
  parcelas: Parcela[];
  cultivos: Cultivo[];
  zafras: Zafra[];
  eventos: Evento[];
  usuarios: Usuario[];
  roles: Rol[];
  insumos: Insumo[];
  maquinaria: Maquinaria[];
  costos: Costo[];
  ventas: Venta[];
  proveedores: Proveedor[];
  clientes: Cliente[];
  compras: Compra[];
  plagas: Plaga[];
  etapasCultivo: EtapaCultivo[];
  empleados: Empleado[];
  asistencias: Asistencia[];
  planDeCuentas: PlanDeCuenta[];
  centrosDeCosto: CentroDeCosto[];
  asientosDiario: AsientoDiario[];
  todosLosEventos: Evento[];
}

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

export const useDataStore = create<DataState>((set) => ({
  parcelas: [],
  cultivos: [],
  zafras: [],
  eventos: [],
  usuarios: [],
  roles: [],
  insumos: [],
  maquinaria: [],
  costos: [],
  ventas: [],
  proveedores: [],
  clientes: [],
  compras: [],
  plagas: [],
  etapasCultivo: [],
  empleados: [],
  asistencias: [],
  planDeCuentas: [],
  centrosDeCosto: [],
  asientosDiario: [],
  todosLosEventos: [],
}));

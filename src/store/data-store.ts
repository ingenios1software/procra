import { create } from 'zustand';
import {
  initialParcelas,
  initialCultivos,
  initialZafras,
  initialEventos,
  initialUsuarios,
  initialRoles,
  initialInsumos,
  initialMaquinaria,
  initialCostos,
  initialVentas,
  initialProveedores,
  initialClientes,
  initialCompras,
  initialPlagas,
  initialEtapasCultivo,
  initialEmpleados,
  initialAsistencias,
  initialPlanDeCuentas,
  initialCentrosDeCosto,
  initialAsientosDiario,
} from '@/lib/mock-data';
import type { Parcela, Cultivo, Zafra, Evento, Usuario, Rol, Insumo, Maquinaria, Costo, Venta, Proveedor, Cliente, Compra, Plaga, EtapaCultivo, Empleado, Asistencia, PlanDeCuenta, CentroDeCosto, AsientoDiario } from '@/lib/types';
import { produce } from 'immer';

interface DataState {
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
  addParcela: (parcela: Omit<Parcela, 'id' | 'tieneEventosRecientes'>) => void;
  updateParcela: (parcela: Parcela) => void;
  deleteParcela: (id: string) => void;
  addCultivo: (cultivo: Omit<Cultivo, 'id'>) => void;
  updateCultivo: (cultivo: Cultivo) => void;
  deleteCultivo: (id: string) => void;
  addZafra: (zafra: Omit<Zafra, 'id'>) => void;
  updateZafra: (zafra: Zafra) => void;
  addEvento: (evento: Omit<Evento, 'id'>) => void;
  addUsuario: (usuario: Omit<Usuario, 'id'>) => void;
  updateUsuario: (usuario: Usuario) => void;
  addInsumo: (insumo: Omit<Insumo, 'id'>) => void;
  updateInsumo: (insumo: Insumo) => void;
  addMaquinaria: (data: Omit<Maquinaria, 'id'>) => void;
  updateMaquinaria: (data: Maquinaria) => void;
  deleteMaquinaria: (id: string) => void;
  addCosto: (costo: Omit<Costo, 'id'>) => void;
  updateCosto: (costo: Costo) => void;
  addVenta: (venta: Omit<Venta, 'id'>) => void;
  updateVenta: (venta: Venta) => void;
}

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

export const useDataStore = create<DataState>((set) => ({
  parcelas: initialParcelas,
  cultivos: initialCultivos,
  zafras: initialZafras,
  eventos: initialEventos,
  usuarios: initialUsuarios,
  roles: initialRoles,
  insumos: initialInsumos,
  maquinaria: initialMaquinaria,
  costos: initialCostos,
  ventas: initialVentas,
  proveedores: initialProveedores,
  clientes: initialClientes,
  compras: initialCompras,
  plagas: initialPlagas,
  etapasCultivo: initialEtapasCultivo,
  empleados: initialEmpleados,
  asistencias: initialAsistencias,
  planDeCuentas: initialPlanDeCuentas,
  centrosDeCosto: initialCentrosDeCosto,
  asientosDiario: initialAsientosDiario,
  todosLosEventos: initialEventos,

  addParcela: (parcela) => set(produce((state) => {
    state.parcelas.push({ ...parcela, id: generateId(), tieneEventosRecientes: false });
  })),

  updateParcela: (parcela) => set(produce((state) => {
    const index = state.parcelas.findIndex(p => p.id === parcela.id);
    if (index !== -1) state.parcelas[index] = parcela;
  })),
  
  deleteParcela: (id) => set(produce((state) => {
    state.parcelas = state.parcelas.filter(p => p.id !== id);
  })),
  
  addCultivo: (cultivo) => set(produce((state) => {
    state.cultivos.push({ ...cultivo, id: generateId() });
  })),

  updateCultivo: (cultivo) => set(produce((state) => {
    const index = state.cultivos.findIndex(c => c.id === cultivo.id);
    if (index !== -1) state.cultivos[index] = cultivo;
  })),
  
  deleteCultivo: (id) => set(produce((state) => {
    state.cultivos = state.cultivos.filter(c => c.id !== id);
  })),

  addZafra: (zafra) => set(produce((state) => {
    state.zafras.push({ ...zafra, id: generateId() });
  })),

  updateZafra: (zafra) => set(produce((state) => {
    const index = state.zafras.findIndex(z => z.id === zafra.id);
    if (index !== -1) state.zafras[index] = zafra;
  })),
  
  addEvento: (evento) => set(produce((state) => {
    state.eventos.push({ ...evento, id: generateId() });
  })),

  addUsuario: (usuario) => set(produce((state) => {
    state.usuarios.push({ ...usuario, id: generateId() });
  })),

  updateUsuario: (usuario) => set(produce((state) => {
    const index = state.usuarios.findIndex(u => u.id === usuario.id);
    if (index !== -1) state.usuarios[index] = usuario;
  })),
  
  addInsumo: (insumo) => set(produce((state) => {
    state.insumos.push({ ...insumo, id: generateId() });
  })),
  
  updateInsumo: (insumo) => set(produce((state) => {
    const index = state.insumos.findIndex(i => i.id === insumo.id);
    if(index !== -1) state.insumos[index] = insumo;
  })),

  addMaquinaria: (data) => set(produce((state) => {
    state.maquinaria.push({ ...data, id: generateId() });
  })),

  updateMaquinaria: (data) => set(produce((state) => {
    const index = state.maquinaria.findIndex(m => m.id === data.id);
    if (index !== -1) state.maquinaria[index] = data;
  })),

  deleteMaquinaria: (id) => set(produce((state) => {
    state.maquinaria = state.maquinaria.filter(m => m.id !== id);
  })),
  
  addCosto: (costo) => set(produce((state) => {
    state.costos.push({ ...costo, id: generateId() });
  })),
  
  updateCosto: (costo) => set(produce((state) => {
    const index = state.costos.findIndex(c => c.id === costo.id);
    if (index !== -1) state.costos[index] = costo;
  })),
  
  addVenta: (venta) => set(produce((state) => {
    state.ventas.push({ ...venta, id: generateId() });
  })),
  
  updateVenta: (venta) => set(produce((state) => {
    const index = state.ventas.findIndex(v => v.id === venta.id);
    if (index !== -1) state.ventas[index] = venta;
  })),
}));

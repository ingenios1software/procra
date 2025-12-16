"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Check, X, Clock, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { format, isValid } from "date-fns";
import type { ControlHorario, Empleado, Parcela } from "@/lib/types";
import { ControlHorarioForm } from "./control-horario-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "./date-range-picker";
import type { DateRange } from "react-day-picker";

interface ControlHorarioListProps {
  registros: ControlHorario[];
  empleados: Empleado[];
  parcelas: Parcela[];
  isLoading: boolean;
}

export function ControlHorarioList({ registros, empleados, parcelas, isLoading }: ControlHorarioListProps) {
  const { user } = useUser();
  const { role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ControlHorario | null>(null);

  const [filters, setFilters] = useState({
    empleadoId: "",
    estado: "",
    dateRange: { from: undefined, to: undefined } as DateRange | undefined,
  });

  const puedeAprobar = role === 'admin' || role === 'supervisor';

  const filteredRegistros = useMemo(() => {
    return registros.filter(registro => {
      const fechaRegistro = new Date(registro.fecha as string);
      const inDateRange = filters.dateRange?.from && filters.dateRange?.to 
        ? fechaRegistro >= filters.dateRange.from && fechaRegistro <= filters.dateRange.to 
        : true;
      
      return (
        inDateRange &&
        (filters.empleadoId ? registro.empleadoId === filters.empleadoId : true) &&
        (filters.estado ? registro.estado === filters.estado : true)
      );
    });
  }, [registros, filters]);


  const getEmpleadoNombre = (id: string) => {
    const empleado = empleados.find(e => e.id === id);
    return empleado ? `${empleado.apellido}, ${empleado.nombre}` : "N/A";
  };
  
  const calculateHoras = (entrada: string, salida: string) => {
    if (!entrada || !salida) return { am: 0, pm: 0, total: 0 };
    
    const [hEntrada, mEntrada] = entrada.split(":").map(Number);
    const [hSalida, mSalida] = salida.split(":").map(Number);
    
    const entradaTotalMinutos = hEntrada * 60 + mEntrada;
    const salidaTotalMinutos = hSalida * 60 + mSalida;
    
    if (salidaTotalMinutos <= entradaTotalMinutos) return { am: 0, pm: 0, total: 0 };
    
    const mediodiaMinutos = 12 * 60;
    
    const inicio = entradaTotalMinutos;
    const fin = salidaTotalMinutos;
    
    const horasAm = Math.max(0, Math.min(fin, mediodiaMinutos) - inicio);
    const horasPm = Math.max(0, fin - Math.max(inicio, mediodiaMinutos));
    
    return {
        am: horasAm / 60,
        pm: horasPm / 60,
        total: (horasAm + horasPm) / 60
    };
  }

  const handleSave = async (data: Omit<ControlHorario, 'id' | 'creadoEn' | 'creadoPor' | 'estado' | 'horasAm' | 'horasPm' | 'horasTotales' | 'aprobadoEn' | 'aprobadoPor' | 'costoManoDeObra'>) => {
    if (!firestore || !user) return;
    
    const { am, pm, total } = calculateHoras(data.horaEntrada, data.horaSalida);
    const empleado = empleados.find(e => e.id === data.empleadoId);
    const costoPorHora = empleado ? empleado.salario / 220 : 0;
    const costoManoDeObra = total * costoPorHora;

    const dataToSave = {
        ...data,
        fecha: (data.fecha as Date).toISOString(),
        horasAm: am,
        horasPm: pm,
        horasTotales: total,
        costoManoDeObra: costoManoDeObra,
    };

    if (selectedRegistro) {
      const registroRef = doc(firestore, 'controlHorario', selectedRegistro.id);
      updateDocumentNonBlocking(registroRef, {...selectedRegistro, ...dataToSave});
      toast({ title: "Registro actualizado" });
    } else {
      addDocumentNonBlocking(collection(firestore, 'controlHorario'), {
        ...dataToSave,
        estado: 'pendiente',
        creadoPor: user.uid,
        creadoEn: serverTimestamp()
      });
      toast({ title: "Registro de horas creado" });
    }
    setFormOpen(false);
  };

  const handleAprobar = (registro: ControlHorario) => {
    if (!firestore || !user) return;
    updateDocumentNonBlocking(doc(firestore, 'controlHorario', registro.id), {
      estado: 'aprobado',
      aprobadoPor: user.uid,
      aprobadoEn: serverTimestamp()
    });
    toast({ title: 'Registro Aprobado', className: 'bg-green-100 text-green-800' });
  };
  
  const handleRechazar = (registro: ControlHorario) => {
     if (!firestore) return;
     updateDocumentNonBlocking(doc(firestore, 'controlHorario', registro.id), { estado: 'rechazado' });
     toast({ title: 'Registro Rechazado', variant: 'destructive' });
  };

  const openForm = (registro?: ControlHorario) => {
    setSelectedRegistro(registro || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Control Horario"
        description="Gestione y apruebe las horas de trabajo del personal."
      >
        <Button onClick={() => openForm()}>
          <PlusCircle className="mr-2" />
          Registrar Horas
        </Button>
      </PageHeader>
      
      <Card className="mb-6">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><SlidersHorizontal/> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Select value={filters.empleadoId} onValueChange={v => setFilters({...filters, empleadoId: v === 'all' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Filtrar por empleado..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.apellido}, {e.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <DateRangePicker 
                date={filters.dateRange}
                onDateChange={(range) => setFilters({...filters, dateRange: range})}
            />
            <Select value={filters.estado} onValueChange={v => setFilters({...filters, estado: v === 'all' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
        </CardContent>
      </Card>
      
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {filteredRegistros.map(registro => (
          <Card key={registro.id} className="w-full" onClick={() => openForm(registro)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">{getEmpleadoNombre(registro.empleadoId)}</CardTitle>
                <CardDescription>{isValid(new Date(registro.fecha as string)) ? format(new Date(registro.fecha as string), "PPP") : 'Fecha inválida'}</CardDescription>
              </div>
               <Badge
                  className={cn("capitalize", {
                    "bg-yellow-100 text-yellow-800 border-yellow-300": registro.estado === 'pendiente',
                    "bg-green-100 text-green-800 border-green-300": registro.estado === 'aprobado',
                    "bg-red-100 text-red-800 border-red-300": registro.estado === 'rechazado',
                  })}
                  variant="outline"
                >{registro.estado}</Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">{registro.horaEntrada}</span>
                    <span className="text-xs text-muted-foreground">Entrada</span>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">{registro.horaSalida}</span>
                    <span className="text-xs text-muted-foreground">Salida</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-muted p-2">
                    <span className="font-bold text-lg text-primary">{registro.horasTotales.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">Total Horas</span>
                </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead className="text-right">Horas AM</TableHead>
                <TableHead className="text-right">Horas PM</TableHead>
                <TableHead className="text-right">Total Horas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center">Cargando...</TableCell></TableRow>}
              {filteredRegistros.map(registro => (
                <TableRow key={registro.id} className="cursor-pointer" onClick={() => openForm(registro)}>
                  <TableCell>{isValid(new Date(registro.fecha as string)) ? format(new Date(registro.fecha as string), "dd/MM/yyyy") : 'Fecha inválida'}</TableCell>
                  <TableCell className="font-medium">{getEmpleadoNombre(registro.empleadoId)}</TableCell>
                  <TableCell>{registro.horaEntrada}</TableCell>
                  <TableCell>{registro.horaSalida}</TableCell>
                  <TableCell className="text-right font-mono">{registro.horasAm.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{registro.horasPm.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{registro.horasTotales.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-yellow-500 hover:bg-yellow-500/80 text-black": registro.estado === 'pendiente',
                        "bg-green-600 hover:bg-green-600/80 text-white": registro.estado === 'aprobado',
                        "bg-red-600 hover:bg-red-600/80 text-white": registro.estado === 'rechazado',
                      })}
                    >{registro.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openForm(registro)}>Ver / Editar</DropdownMenuItem>
                        {puedeAprobar && registro.estado === 'pendiente' && (
                          <>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAprobar(registro); }} className="text-green-600 focus:text-green-700 focus:bg-green-50"><Check className="mr-2"/>Aprobar</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRechazar(registro); }} className="text-red-600 focus:text-red-700 focus:bg-red-50"><X className="mr-2"/>Rechazar</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filteredRegistros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24">No se encontraron registros para los filtros seleccionados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedRegistro ? 'Editar' : 'Registrar'} Horas</DialogTitle>
            <DialogDescription>Complete los datos del registro de trabajo.</DialogDescription>
          </DialogHeader>
          <ControlHorarioForm
            registro={selectedRegistro}
            empleados={empleados}
            parcelas={parcelas}
            onSubmit={handleSave}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

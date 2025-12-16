"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import type { ControlHorario, Empleado } from "@/lib/types";
import { ControlHorarioForm } from "./control-horario-form";
import { cn } from "@/lib/utils";

interface ControlHorarioListProps {
  registros: ControlHorario[];
  empleados: Empleado[];
  isLoading: boolean;
}

export function ControlHorarioList({ registros, empleados, isLoading }: ControlHorarioListProps) {
  const { user } = useUser();
  const { role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ControlHorario | null>(null);

  const puedeAprobar = role === 'admin' || role === 'supervisor';

  const getEmpleadoNombre = (id: string) => {
    const empleado = empleados.find(e => e.id === id);
    return empleado ? `${empleado.apellido}, ${empleado.nombre}` : "N/A";
  };
  
  const handleSave = async (data: Omit<ControlHorario, 'id' | 'creadoEn' | 'creadoPor'>) => {
    if (!firestore || !user) return;

    if (selectedRegistro) {
      const registroRef = doc(firestore, 'controlHorario', selectedRegistro.id);
      updateDocumentNonBlocking(registroRef, {
        ...data,
        fecha: (data.fecha as Date).toISOString()
      });
      toast({ title: "Registro actualizado" });
    } else {
      addDocumentNonBlocking(collection(firestore, 'controlHorario'), {
        ...data,
        fecha: (data.fecha as Date).toISOString(),
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
    toast({ title: 'Registro Aprobado' });
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
      <Card>
        <CardHeader>
          <CardTitle>Registros de Horas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Horas Trabajadas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>}
              {registros.map(registro => (
                <TableRow key={registro.id}>
                  <TableCell>{format(new Date(registro.fecha as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{getEmpleadoNombre(registro.empleadoId)}</TableCell>
                  <TableCell className="font-mono">{registro.horasTrabajadas.toFixed(2)} hs</TableCell>
                  <TableCell>
                    <Badge
                      className={cn({
                        "bg-yellow-500 text-black": registro.estado === 'pendiente',
                        "bg-green-600 text-white": registro.estado === 'aprobado',
                        "bg-red-600 text-white": registro.estado === 'rechazado',
                      })}
                    >{registro.estado}</Badge>
                  </TableCell>
                  <TableCell>{registro.observacion}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openForm(registro)} disabled={registro.estado !== 'pendiente'}>Editar</DropdownMenuItem>
                        {puedeAprobar && registro.estado === 'pendiente' && (
                          <>
                            <DropdownMenuItem onClick={() => handleAprobar(registro)}>Aprobar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRechazar(registro)} className="text-destructive">Rechazar</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRegistro ? 'Editar' : 'Registrar'} Horas</DialogTitle>
            <DialogDescription>Complete los datos del registro de trabajo.</DialogDescription>
          </DialogHeader>
          <ControlHorarioForm
            registro={selectedRegistro}
            empleados={empleados}
            onSubmit={handleSave}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

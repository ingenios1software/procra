"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Maquinaria } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface MaquinariaListProps {
  initialMaquinarias: Maquinaria[];
}

export function MaquinariaList({ initialMaquinarias }: MaquinariaListProps) {
  const [maquinarias, setMaquinarias] = useState(initialMaquinarias);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador' || role === 'gerente';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Listado de Maquinaria</CardTitle>
        {canModify && (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Maquinaria
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Horas de Trabajo</TableHead>
              <TableHead>Estado</TableHead>
              {canModify && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {maquinarias.map((maquinaria) => (
              <TableRow key={maquinaria.id}>
                <TableCell className="font-medium">{maquinaria.nombre}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{maquinaria.tipo}</Badge>
                </TableCell>
                <TableCell>{maquinaria.horasTrabajo} hs</TableCell>
                <TableCell>
                   <Badge 
                      className={cn('capitalize', {
                        'bg-green-600 text-primary-foreground': maquinaria.estado === 'operativa',
                        'bg-amber-500 text-amber-foreground': maquinaria.estado === 'en mantenimiento',
                        'bg-destructive text-destructive-foreground': maquinaria.estado === 'fuera de servicio',
                      })}
                    >
                      {maquinaria.estado.replace(/([A-Z])/g, ' $1')}
                    </Badge>
                </TableCell>
                {canModify && (
                  <TableCell className="text-right">
                     <Button variant="outline" size="sm">
                        <Wrench className="mr-2 h-4 w-4" />
                        Registrar Mantenimiento
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

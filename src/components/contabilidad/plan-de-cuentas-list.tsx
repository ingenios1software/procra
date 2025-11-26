"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlanDeCuenta } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PlanDeCuentasListProps {
  initialData: PlanDeCuenta[];
}

export function PlanDeCuentasList({ initialData }: PlanDeCuentasListProps) {
  const [cuentas, setCuentas] = useState(initialData);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {canModify && (
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Cuenta
              </Button>
            )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Cuentas Contables</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Naturaleza</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentas.map((cuenta) => (
                <TableRow key={cuenta.id}>
                  <TableCell className="font-mono">{cuenta.codigo}</TableCell>
                  <TableCell className="font-medium">{cuenta.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{cuenta.tipo}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{cuenta.naturaleza}</TableCell>
                  {canModify && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

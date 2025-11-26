"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CentroDeCosto } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

interface CentrosDeCostoListProps {
  initialData: CentroDeCosto[];
}

export function CentrosDeCostoList({ initialData }: CentrosDeCostoListProps) {
  const [centros, setCentros] = useState(initialData);
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
                Nuevo Centro de Costo
              </Button>
            )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Centros de Costo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {centros.map((centro) => (
                <TableRow key={centro.id}>
                  <TableCell className="font-medium">{centro.nombre}</TableCell>
                  <TableCell>{centro.descripcion}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{centro.categoria}</Badge>
                  </TableCell>
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

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Download, FilePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AsientoDiario, PlanDeCuenta, CentroDeCosto } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface DiarioListProps {
  initialData: AsientoDiario[];
  planDeCuentas: PlanDeCuenta[];
  centrosDeCosto: CentroDeCosto[];
}

export function DiarioList({ initialData, planDeCuentas, centrosDeCosto }: DiarioListProps) {
  const [asientos, setAsientos] = useState(initialData);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const getCuentaNombre = (id: string) => planDeCuentas.find(c => c.id === id)?.nombre || 'N/A';

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
                Nuevo Asiento
              </Button>
            )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Asientos del Libro Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {asientos.map((asiento) => (
              <AccordionItem value={asiento.id} key={asiento.id}>
                <AccordionTrigger>
                  <div className="flex justify-between w-full pr-4">
                    <span className="font-medium">{format(asiento.fecha, "dd/MM/yyyy")} - {asiento.descripcion}</span>
                    <Badge>Asiento #{asiento.id}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asiento.movimientos.map((mov, index) => (
                        <TableRow key={index}>
                          <TableCell>{getCuentaNombre(mov.cuentaId)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {mov.tipo === 'debe' ? `$${mov.monto.toLocaleString('es-AR')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {mov.tipo === 'haber' ? `$${mov.monto.toLocaleString('es-AR')}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}

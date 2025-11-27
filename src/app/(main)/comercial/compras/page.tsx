
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockCompras, mockProveedores } from "@/lib/mock-data";
import type { Compra } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export default function ComprasPage() {
  const [compras, setCompras] = useState(mockCompras);
  const router = useRouter();

  const getProveedorNombre = (id: string) => {
    return mockProveedores.find(p => p.id === id)?.nombre || 'N/A';
  }

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Gestión de Compras"
        description="Registre y administre las compras de insumos, productos y servicios."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            <Button onClick={() => router.push('/comercial/compras/crear')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Compra
            </Button>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compras.map((compra) => (
                <TableRow key={compra.id}>
                  <TableCell>{format(new Date(compra.fecha), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{compra.numeroDocumento}</span>
                      <span className="text-xs text-muted-foreground">{compra.tipoDocumento}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getProveedorNombre(compra.proveedorId)}</TableCell>
                  <TableCell>
                    <Badge variant={compra.condicion === 'Contado' ? 'secondary' : 'outline'}>
                      {compra.condicion}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn({
                        "bg-blue-500 text-white": compra.estado === 'Registrado',
                        "bg-yellow-500 text-black": compra.estado === 'Aprobado',
                        "bg-green-600 text-white": compra.estado === 'Pagado',
                      })}
                    >
                      {compra.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">${compra.total.toLocaleString('en-US')}</TableCell>
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem>Ver Detalle</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Anular</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

    
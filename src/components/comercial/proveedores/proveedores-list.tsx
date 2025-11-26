"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Proveedor } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

interface ProveedoresListProps {
  initialProveedores: Proveedor[];
}

export function ProveedoresList({ initialProveedores }: ProveedoresListProps) {
  const [proveedores, setProveedores] = useState(initialProveedores);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const handleToggleActive = (id: string) => {
    setProveedores(prev =>
      prev.map(p => (p.id === id ? { ...p, activo: !p.activo } : p))
    );
  };
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Gestione los proveedores de insumos y servicios."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          {canModify && (
            <Button asChild>
              <Link href="/comercial/proveedores/crear">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Proveedor
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((proveedor) => (
                <TableRow key={proveedor.id}>
                  <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                  <TableCell>{proveedor.ruc}</TableCell>
                  <TableCell>{proveedor.telefono || 'N/A'}</TableCell>
                  <TableCell>{proveedor.email || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={proveedor.activo ? 'default' : "destructive"}>
                      {proveedor.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {canModify && (
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
                          <DropdownMenuItem asChild>
                            <Link href={`/comercial/proveedores/${proveedor.id}/editar`}>Editar</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(proveedor.id)}>
                            {proveedor.activo ? 'Desactivar' : 'Activar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

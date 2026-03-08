"use client";

import Link from "next/link";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser, updateDocumentNonBlocking } from "@/firebase";
import type { Cliente } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

interface ClientesListProps {
  clientes: Cliente[];
  isLoading: boolean;
}

export function ClientesList({ clientes, isLoading }: ClientesListProps) {
  const { user } = useUser();
  const tenant = useTenantFirestore();

  const handleToggleActive = (id: string) => {
    const cliente = clientes.find((item) => item.id === id);
    const clienteRef = tenant.doc("clientes", id);
    if (!cliente || !clienteRef) return;
    updateDocumentNonBlocking(clienteRef, { activo: !cliente.activo });
  };

  const shareSummary = `Total de clientes: ${clientes.length}.`;

  return (
    <>
      <PageHeader title="Clientes" description="Gestione la cartera de clientes de la empresa.">
        <ReportActions reportTitle="Clientes" reportSummary={shareSummary} />
        {user && (
          <Button asChild>
            <Link href="/comercial/clientes/crear">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Link>
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item No</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RUC</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  {user && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium text-muted-foreground">{cliente.numeroItem}</TableCell>
                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                    <TableCell>{cliente.ruc}</TableCell>
                    <TableCell>{cliente.telefono || "N/A"}</TableCell>
                    <TableCell>{cliente.email || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={cliente.activo ? "default" : "destructive"}>
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {user && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/comercial/clientes/${cliente.id}/editar`}>Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(cliente.id)}>
                              {cliente.activo ? "Desactivar" : "Activar"}
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
      </div>
    </>
  );
}

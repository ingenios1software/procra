"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Cliente } from "@/lib/types";
import { useAuth, useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { collection, doc, query, orderBy } from 'firebase/firestore';


export function ClientesList() {
  const firestore = useFirestore();
  const clientesQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'clientes'), orderBy('nombre')) : null
  , [firestore]);
  const { data: clientes, isLoading } = useCollection<Cliente>(clientesQuery);

  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const handleToggleActive = (id: string) => {
    if (!firestore || !clientes) return;
    const cliente = clientes.find(c => c.id === id);
    if (!cliente) return;
    const clienteRef = doc(firestore, 'clientes', id);
    updateDocumentNonBlocking(clienteRef, { activo: !cliente.activo });
  };
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Gestione la cartera de clientes de la empresa."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          {canModify && (
            <Button asChild>
              <Link href="/comercial/clientes/crear">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Cliente
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Clientes</CardTitle>
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
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>}
              {clientes?.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nombre}</TableCell>
                  <TableCell>{cliente.ruc}</TableCell>
                  <TableCell>{cliente.telefono || 'N/A'}</TableCell>
                  <TableCell>{cliente.email || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={cliente.activo ? 'default' : "destructive"}>
                      {cliente.activo ? 'Activo' : 'Inactivo'}
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
                            <Link href={`/comercial/clientes/editar/${cliente.id}`}>Editar</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(cliente.id)}>
                            {cliente.activo ? 'Desactivar' : 'Activar'}
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

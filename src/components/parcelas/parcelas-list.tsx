"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Parcela } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ParcelasListProps {
  initialParcelas: Parcela[];
}

export function ParcelasList({ initialParcelas }: ParcelasListProps) {
  const [parcelas, setParcelas] = useState(initialParcelas);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador';

  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Gestione las parcelas de su establecimiento."
      >
        {canModify && (
          <Button asChild>
            <Link href="/parcelas/crear">
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Parcela
            </Link>
          </Button>
        )}
      </PageHeader>
      
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Superficie (ha)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((parcela) => (
                <TableRow key={parcela.id}>
                  <TableCell className="font-medium">
                     <Link href={`/parcelas/${parcela.id}`} className="hover:underline">
                      {parcela.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{parcela.codigo}</TableCell>
                  <TableCell>{parcela.superficie}</TableCell>
                  <TableCell>
                    <Badge variant={parcela.estado === 'activa' ? 'default' : 'secondary'} className={cn(parcela.estado === 'activa' && 'bg-green-600')}>{parcela.estado}</Badge>
                  </TableCell>
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
                          <Link href={`/parcelas/${parcela.id}`}>Ver Detalles</Link>
                        </DropdownMenuItem>
                        {canModify && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/parcelas/editar/${parcela.id}`}>Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
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
    </>
  );
}

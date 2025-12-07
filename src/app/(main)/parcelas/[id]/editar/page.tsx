"use client";

import { useMemo } from 'react';
import { notFound, useRouter } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';
import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';


export default function EditarParcelaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { id } = params;
  
  const parcelaRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'parcelas', id);
  }, [firestore, id]);

  const { data: parcela, isLoading } = useDoc<Parcela>(parcelaRef);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <p>Cargando datos de la parcela...</p>
        </div>
    );
  }

  if (!parcela) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-destructive"/>
                        Parcela no encontrada
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>La parcela que intenta editar no existe o fue eliminada.</p>
                    <Button onClick={() => router.push('/parcelas')}>
                        Volver a la lista
                    </Button>
                </CardContent>
            </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar Parcela"
        description={`Editando los detalles de ${parcela.nombre}.`}
      />
      <ParcelaForm parcela={{...parcela, id: id}} />
    </>
  );
}

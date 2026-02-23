"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, getCountFromServer } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { 
    Entidad, 
    Insumo, 
    CuentaCajaBanco, 
    CuentaContable, 
    Moneda, 
    PlanFinanciacion, 
    TipoDocumento, 
    FormaPago, 
    Deposito 
} from "@/lib/types";

const masterCollections = [
    { name: "Depósitos", collection: "depositos", path: "/maestros/depositos" },
    { name: "Productos / Insumos", collection: "insumos", path: "/stock" },
    { name: "Entidades (Clientes/Proveedores)", collection: "entidades", path: "/maestros/entidades" },
    { name: "Cuentas de Caja/Banco", collection: "cuentasCajaBanco", path: "/maestros/cuentas-caja-banco" },
    { name: "Plan de Cuentas", collection: "planDeCuentas", path: "/contabilidad/plan-de-cuentas" },
    { name: "Monedas", collection: "monedas", path: "/maestros/monedas" },
    { name: "Planes de Financiación", collection: "planesFinanciacion", path: "/maestros/planes-financiacion" },
    { name: "Tipos de Documento", collection: "tiposDocumento", path: "/maestros/tipos-documento" },
    { name: "Formas de Pago", collection: "formasPago", path: "/maestros/formas-pago" },
];

interface MasterStatus {
    name: string;
    count: number;
    isLoading: boolean;
    path: string;
}

export default function ChecklistPage() {
  const firestore = useFirestore();
  const [statuses, setStatuses] = useState<MasterStatus[]>(masterCollections.map(m => ({ ...m, count: 0, isLoading: true })));

  useEffect(() => {
    if (!firestore) return;

    const fetchCounts = async () => {
      const counts = await Promise.all(masterCollections.map(async (master) => {
        try {
          const coll = collection(firestore, master.collection);
          const snapshot = await getCountFromServer(coll);
          return { name: master.name, count: snapshot.data().count, isLoading: false, path: master.path };
        } catch (error) {
          console.error(`Error fetching count for ${master.collection}:`, error);
          return { name: master.name, count: 0, isLoading: false, path: master.path };
        }
      }));
      setStatuses(counts);
    };

    fetchCounts();
  }, [firestore]);
  

  return (
    <>
      <PageHeader
        title="Checklist de Configuración Inicial"
        description="Verifique el estado de los datos maestros necesarios para el correcto funcionamiento del sistema."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{status.name}</span>
                {status.isLoading ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <Badge variant={status.count > 0 ? "default" : "destructive"} className={status.count > 0 ? "bg-green-600" : ""}>
                    {status.count > 0 ? <CheckCircle className="mr-2 h-4 w-4" /> : <AlertCircle className="mr-2 h-4 w-4" />}
                    {status.count > 0 ? "OK" : "Falta configurar"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{status.isLoading ? '-' : status.count}</p>
              <p className="text-sm text-muted-foreground">registros encontrados.</p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href={status.path}>Ir a gestionar</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}

    

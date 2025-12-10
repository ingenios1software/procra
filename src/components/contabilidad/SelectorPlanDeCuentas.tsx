"use client";

import { useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { PlanDeCuenta } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

interface SelectorPlanDeCuentasProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  filter?: "gasto" | "costo" | "ingreso" | "todas";
  disabled?: boolean;
}

export function SelectorPlanDeCuentas({
  value,
  onChange,
  filter = "todas",
  disabled = false,
}: SelectorPlanDeCuentasProps) {
  const firestore = useFirestore();

  const planDeCuentasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    const coleccion = collection(firestore, "planDeCuentas");

    if (filter === "gasto") {
      return query(coleccion, where("tipo", "in", ["gasto", "costo"]), orderBy("codigo"));
    }
    if (filter !== "todas") {
      return query(coleccion, where("tipo", "==", filter), orderBy("codigo"));
    }
    return query(coleccion, orderBy("codigo"));
  }, [firestore, filter]);

  const { data: cuentas, isLoading } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const sortedCuentas = useMemo(() => {
    if (!cuentas) return [];
    // Firestore's orderBy('codigo') is lexicographical, we need numerical.
    return [...cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [cuentas]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando cuentas...</span>
      </div>
    );
  }

  return (
    <Select
      value={value || ""}
      onValueChange={(val) => onChange(val === "none" ? null : val)}
      disabled={disabled || isLoading}
    >
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Asociar a una cuenta..." />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="none">Sin asociar</SelectItem>
        {sortedCuentas.map((cuenta) => (
          <SelectItem key={cuenta.id} value={cuenta.id}>
            {cuenta.codigo} – {cuenta.nombre}
          </SelectItem>
        ))}
        {sortedCuentas.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
                No hay cuentas para este filtro.
            </div>
        )}
      </SelectContent>
    </Select>
  );
}

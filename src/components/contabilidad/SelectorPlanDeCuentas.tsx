"use client";

import type { PlanDeCuenta } from "@/lib/types";
import { SelectorUniversal } from "@/components/common/SelectorUniversal";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, orderBy, query } from "firebase/firestore";

interface SelectorPlanDeCuentasProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  filter?: "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto";
  disabled?: boolean;
  label?: string;
}

export function SelectorPlanDeCuentas({
  value,
  onChange,
  filter,
  disabled,
  label = "Cuenta Contable",
}: SelectorPlanDeCuentasProps) {
  const firestore = useFirestore();

  const planDeCuentasQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "planDeCuentas"), orderBy("codigo")) : null),
    [firestore]
  );
  const { data: cuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const selectedCuenta = (cuentas || []).find((c) => c.id === value);
  const normalizedFilter = (filter || "").toLowerCase().trim();
  const itemFilter = normalizedFilter
    ? (item: PlanDeCuenta) => (item.tipo || "").toLowerCase().trim() === normalizedFilter
    : undefined;

  const handleSelect = (cuenta?: PlanDeCuenta) => {
    onChange(cuenta ? cuenta.id : null);
  };

  return (
    <SelectorUniversal<PlanDeCuenta>
      label={label}
      collectionName="planDeCuentas"
      displayField="nombre"
      codeField="codigo"
      value={selectedCuenta}
      onSelect={handleSelect}
      searchFields={["nombre", "codigo"]}
      itemFilter={itemFilter}
      extraInfoFields={[
        { label: "Tipo", field: "tipo" },
        { label: "Naturaleza", field: "naturaleza" },
      ]}
      disabled={disabled}
    />
  );
}

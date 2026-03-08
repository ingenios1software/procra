"use client";

import type { PlanDeCuenta } from "@/lib/types";
import { SelectorUniversal } from "@/components/common/SelectorUniversal";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

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
  const tenant = useTenantFirestore();

  const planDeCuentasQuery = useMemoFirebase(
    () => tenant.query("planDeCuentas", orderBy("codigo")),
    [tenant]
  );
  const { data: cuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const selectedCuenta = (cuentas || []).find((cuenta) => cuenta.id === value);
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

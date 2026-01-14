"use client";

import type { Insumo } from "@/lib/types";
import { SelectorUniversal } from "@/components/common/SelectorUniversal";

interface InsumoSelectorProps {
  value?: Insumo;
  onChange: (insumo?: Insumo) => void;
  disabled?: boolean;
}

export function InsumoSelector({ value, onChange, disabled }: InsumoSelectorProps) {

  return (
    <SelectorUniversal<Insumo>
      label="Insumo"
      collectionName="insumos"
      displayField="nombre"
      codeField="numeroItem"
      value={value}
      onSelect={onChange}
      searchFields={['nombre', 'numeroItem', 'principioActivo']}
      extraInfoFields={[
        { label: 'Stock', field: 'stockActual', format: (val) => (val || 0).toLocaleString('de-DE') },
        { label: 'Unidad', field: 'unidad'},
        { label: 'P.A.', field: 'principioActivo' },
        {
            label: "Precio",
            field: "precioPromedioCalculado",
            format: (val) =>
              `$${(val || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
        },
      ]}
      disabled={disabled}
    />
  );
}

import { useMemo } from "react";

export type ItemCompra = {
  cantidad: number;
  precioUnitario: number;
  iva: "10" | "5" | "EXENTO";
};

export function useCompraTotals(items: ItemCompra[]) {
  return useMemo(() => {
    const resumen = items.reduce(
      (acc, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        const valor = cantidad * precio;

        if (item.iva === "10") acc.gravado10 += valor;
        else if (item.iva === "5") acc.gravado5 += valor;
        else acc.exento += valor;

        return acc;
      },
      { gravado10: 0, gravado5: 0, exento: 0 }
    );

    const iva10 = resumen.gravado10 / 11;
    const iva5 = resumen.gravado5 / 21;

    const totalGeneral =
      resumen.gravado10 + resumen.gravado5 + resumen.exento;

    return {
      ...resumen,
      iva10,
      iva5,
      totalGeneral,
    };
  }, [items]);
}

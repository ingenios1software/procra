"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CultivosList } from "@/components/cultivos/cultivos-list";
import { useDataStore } from "@/store/data-store";

export default function CultivosPage() {
  const { cultivos } = useDataStore();

  return (
    <>
      <CultivosList initialCultivos={cultivos} />
    </>
  );
}

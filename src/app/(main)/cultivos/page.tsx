"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CultivosList } from "@/components/cultivos/cultivos-list";
import { mockCultivos } from "@/lib/mock-data";

export default function CultivosPage() {
  const cultivos = mockCultivos;

  return (
    <>
      <CultivosList initialCultivos={cultivos} />
    </>
  );
}

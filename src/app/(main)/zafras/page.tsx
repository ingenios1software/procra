"use client";

import { useDataStore } from "@/store/data-store";
import { ZafrasList } from "@/components/zafras/zafras-list";

export default function ZafrasPage() {
  const { zafras, addZafra, updateZafra } = useDataStore();

  return (
    <ZafrasList 
      initialZafras={zafras}
      onAdd={addZafra}
      onUpdate={updateZafra}
    />
  );
}

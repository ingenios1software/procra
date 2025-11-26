import { PageHeader } from "@/components/shared/page-header";
import { ZafrasList } from "@/components/zafras/zafras-list";
import { mockZafras } from "@/lib/mock-data";

export default function ZafrasPage() {
  const zafras = mockZafras;

  return (
    <>
      <ZafrasList initialZafras={zafras} />
    </>
  );
}

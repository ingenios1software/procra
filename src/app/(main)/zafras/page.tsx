"use client";

import { FirebaseClientProvider } from "@/firebase";
import { ZafrasList } from "@/components/zafras/zafras-list";

export default function ZafrasPage() {
  return (
    <FirebaseClientProvider>
      <ZafrasList />
    </FirebaseClientProvider>
  );
}

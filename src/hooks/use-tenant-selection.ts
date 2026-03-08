"use client";

import { useContext } from "react";
import { TenantSelectionContext } from "@/context/tenant-selection-context";

export function useTenantSelection() {
  const context = useContext(TenantSelectionContext);
  if (context === undefined) {
    throw new Error("useTenantSelection must be used within a TenantSelectionProvider");
  }
  return context;
}

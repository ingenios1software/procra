"use client";

import { RolesList } from "@/components/roles/roles-list";
import { useDataStore } from "@/store/data-store";

export default function RolesPage() {
  const { roles } = useDataStore();
  return (
    <RolesList 
      initialRoles={roles}
    />
  );
}

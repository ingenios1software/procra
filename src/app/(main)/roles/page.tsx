"use client";

import { RolesList } from "@/components/roles/roles-list";
import { mockRoles } from "@/lib/mock-data";

export default function RolesPage() {
  return (
    <RolesList 
      initialRoles={mockRoles}
    />
  );
}

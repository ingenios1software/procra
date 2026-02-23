import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout>{children}</AuthenticatedLayout>
  );
}

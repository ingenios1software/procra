import { FirebaseClientProvider } from "@/firebase";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </FirebaseClientProvider>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/configuracion/profile-form";
import { AppearanceForm } from "@/components/configuracion/appearance-form";

export default function ConfiguracionPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Gestiona tu perfil y las preferencias de la aplicación."
      />
      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="apariencia">
          <AppearanceForm />
        </TabsContent>
      </Tabs>
    </>
  );
}

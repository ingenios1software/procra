import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function AcercaDePage() {
  return (
    <>
      <PageHeader
        title="Acerca de CRApro95"
        description="Conozca la historia, los objetivos y los valores de nuestra plataforma."
      />
      <div className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">
              CRApro95 — Control de Registro Agropecuario Profesional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-lg text-foreground/80">
            <p className="leading-relaxed">
              CRApro95 es una plataforma desarrollada para modernizar la gestión agrícola, integrando parcelas, cultivos, zafras, eventos, insumos, maquinaria, costos y análisis.
            </p>
            <p className="leading-relaxed text-md p-4 bg-muted/50 rounded-lg border">
              El número 95 del nombre hace referencia al año 1995, cuando su creador encontró una fotocopia de un teclado en un basurero. Ese papel despertó una curiosidad que con el paso del tiempo se convirtió en la base de su vida digital y en la inspiración para este sistema.
            </p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Objetivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-none space-y-2">
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Unificar información de campo en un solo lugar.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Facilitar la toma de decisiones basada en datos.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Registrar cada evento operativo con precisión y contexto.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Mejorar la gestión de insumos, maquinaria y costos.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Acompañar el ciclo de vida completo de cada zafra.</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Valores del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg text-center">
                        <p className="font-bold text-primary">Simplicidad</p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg text-center">
                        <p className="font-bold text-primary">Transparencia</p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg text-center">
                        <p className="font-bold text-primary">Eficiencia</p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg text-center">
                        <p className="font-bold text-primary">Profesionalismo</p>
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4">
            <p>Versión instalada: <strong>CRApro95 Enterprise Edition</strong>.</p>
        </div>
      </div>
    </>
  );
}

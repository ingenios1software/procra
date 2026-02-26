import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Zap } from "lucide-react";

export default function AcercaDePage() {
  const shareSummary =
    "CRApro95 es un sistema de gestion agropecuaria orientado a registro, trazabilidad y analisis. Objetivos: unificar informacion, mejorar trazabilidad y apoyar decisiones con datos.";

  return (
    <>
      <PageHeader
        title="Acerca de CRApro95"
        description="Conozca el alcance funcional, los objetivos y los principios de la plataforma."
      >
        <ReportActions
          reportTitle="Acerca de CRApro95"
          reportSummary={shareSummary}
          imageTargetId="acerca-share-content"
        />
      </PageHeader>
      <div id="acerca-share-content" className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">
              CRApro95 - Control de Registro Agropecuario Profesional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-lg text-foreground/80">
            <p className="leading-relaxed">
              CRApro95 es un sistema de gestion agropecuaria enfocado en registro operativo, trazabilidad y analisis.
            </p>
            <p className="leading-relaxed">
              Centraliza informacion de parcelas, cultivos, zafras, eventos, insumos, maquinaria y costos para apoyar decisiones basadas en datos.
            </p>
            <p className="leading-relaxed text-md p-4 bg-muted/50 rounded-lg border">
              Sobre el nombre: segun su creador, el numero 95 remite a un hito personal de 1995 que inspiro el origen del proyecto.
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
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Unificar la informacion operativa de campo en un solo lugar.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Mejorar la calidad del registro y la trazabilidad por zafra.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Facilitar analisis de costos, rendimiento y eficiencia.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Reducir tiempos administrativos y errores de carga.</li>
                <li className="flex items-start"><CheckCircle className="h-5 w-5 text-primary mr-3 mt-1 shrink-0" /> Dar soporte a decisiones tecnicas y de gestion con datos.</li>
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

        <Card className="bg-accent/10 border-accent/50">
          <CardHeader className="flex-row items-center gap-4">
            <Zap className="w-8 h-8 text-accent" />
            <CardTitle className="font-headline text-xl text-accent-foreground">Desarrollo Asistido y Evolutivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-accent-foreground/80">
              CRApro95 se desarrolla con colaboracion entre su creador y herramientas de inteligencia artificial para acelerar prototipos, documentacion y mejora continua. Las decisiones funcionales y de negocio se validan segun criterios operativos reales del campo.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Version instalada: <strong>CRApro95</strong>.</p>
        </div>
      </div>
    </>
  );
}

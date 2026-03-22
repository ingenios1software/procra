import Image from "next/image";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultReportBranding, systemLogoSrc } from "@/lib/report-branding";
import {
  permissionLabels,
  systemGuideAccessModel,
  systemGuideArchitecture,
  systemGuideEvolution,
  systemGuideFlows,
  systemGuideHighlights,
  systemGuideIntegrations,
  systemGuideMeta,
  systemGuideModules,
} from "@/lib/system-guide";

const lastUpdated = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "long",
  timeZone: "America/Asuncion",
}).format(new Date());

const modulePageGroups = [systemGuideModules.slice(0, 4), systemGuideModules.slice(4)];

export default function GuiaDelSistemaPage() {
  const shareSummary =
    "Guia institucional y funcional de CRApro95 con alcance, arquitectura, modulos, permisos e integraciones del sistema.";

  return (
    <>
      <PageHeader
        title={`${systemGuideMeta.documentTitle} ${systemGuideMeta.systemName}`}
        description="Documento general de referencia para comprender el alcance, la estructura y la evolucion de la plataforma."
      >
        <ReportActions
          reportTitle={`Guia del Sistema ${systemGuideMeta.systemName}`}
          reportSummary={shareSummary}
          printTargetId="system-guide-print"
          imageTargetId="system-guide-print"
          documentLabel="Guia del sistema"
          branding={defaultReportBranding}
        />
      </PageHeader>

      <div id="system-guide-print" className="print-area mx-auto max-w-6xl space-y-8" data-report-root>
        <section data-pdf-page className="space-y-8">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 break-inside-avoid">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="text-sm">{systemGuideMeta.systemName}</Badge>
                <Badge variant="outline" className="text-sm">
                  Version {systemGuideMeta.version}
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  {systemGuideMeta.status}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  Actualizado: {lastUpdated}
                </Badge>
              </div>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="font-headline text-3xl text-primary md:text-4xl">
                    Guia institucional y funcional de {systemGuideMeta.systemName}
                  </CardTitle>
                  <CardDescription className="max-w-4xl">
                    Esta guia resume que es CRApro95, como esta organizado, que modulos integra y de que manera se
                    administra su operacion dentro de un esquema multiempresa.
                  </CardDescription>
                </div>
                <div className="w-full max-w-xs rounded-2xl border bg-white/90 p-4 shadow-sm">
                  <Image
                    src={systemLogoSrc}
                    alt="Logo CRApro95"
                    width={500}
                    height={180}
                    priority
                    className="h-auto w-full object-contain"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="font-headline text-2xl text-foreground">Vision general</h2>
                  {systemGuideMeta.summary.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-7 text-foreground/80">
                      {paragraph}
                    </p>
                  ))}
                </div>
                <div className="space-y-3">
                  <h3 className="font-headline text-xl text-foreground">Objetivos del sistema</h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground/80">
                    {systemGuideMeta.objectives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <Card className="border-dashed break-inside-avoid">
                  <CardHeader>
                    <CardTitle className="font-headline text-xl">Dirigido a</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground/80">
                      {systemGuideMeta.audiences.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-dashed break-inside-avoid">
                  <CardHeader>
                    <CardTitle className="font-headline text-xl">Principios</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {systemGuideMeta.principles.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-md px-2 py-1 text-xs font-medium">
                        {item}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </section>

        <section data-pdf-page className="space-y-8">
          <section className="grid gap-6 md:grid-cols-3">
            {systemGuideHighlights.map((item) => (
              <Card key={item.title} className="break-inside-avoid">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-foreground/80">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="font-headline text-2xl text-primary">Arquitectura de la plataforma</CardTitle>
                <CardDescription>
                  Componentes tecnicos y organizativos que sostienen el funcionamiento general del sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemGuideArchitecture.map((item) => (
                  <article key={item.title} className="rounded-lg border border-border/60 p-4">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">{item.description}</p>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="font-headline text-2xl text-primary">Modelo de acceso y seguridad</CardTitle>
                <CardDescription>
                  El acceso a la informacion depende del usuario, su rol, la empresa seleccionada y el estado comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemGuideAccessModel.map((item) => (
                  <article key={item.title} className="rounded-lg border border-border/60 p-4">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">{item.description}</p>
                  </article>
                ))}
              </CardContent>
            </Card>
          </section>
        </section>

        {modulePageGroups.map((moduleGroup, pageIndex) => (
          <section key={`module-page-${pageIndex}`} data-pdf-page className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-headline text-3xl text-primary">
                {pageIndex === 0 ? "Mapa funcional del sistema" : "Mapa funcional del sistema - continuacion"}
              </h2>
              <p className="text-base text-muted-foreground">
                {pageIndex === 0
                  ? "Los siguientes bloques reflejan los modulos reales presentes en la navegacion principal de CRApro95."
                  : "Continuacion de los modulos y capacidades principales de la plataforma."}
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {moduleGroup.map((module) => (
                <Card key={module.title} className="break-inside-avoid">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {permissionLabels[module.permission]}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="font-headline text-2xl">{module.title}</CardTitle>
                      <CardDescription>{module.summary}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Capacidades clave
                      </h3>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground/80">
                        {module.capabilities.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Rutas representativas
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {module.routes.map((route) => (
                          <Badge key={route} variant="outline" className="rounded-md px-2 py-1 text-xs font-medium">
                            {route}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <section data-pdf-page className="space-y-8">
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-headline text-3xl text-primary">Flujos principales</h2>
              <p className="text-base text-muted-foreground">
                Vista resumida de como se articula la operacion dentro del sistema.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {systemGuideFlows.map((flow) => (
                <Card key={flow.title} className="break-inside-avoid">
                  <CardHeader>
                    <CardTitle className="font-headline text-2xl">{flow.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground/80">
                      {flow.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="font-headline text-2xl text-primary">Integraciones y soporte</CardTitle>
                <CardDescription>
                  Servicios y capacidades complementarias que fortalecen la operacion diaria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemGuideIntegrations.map((item) => (
                  <article key={item.title} className="rounded-lg border border-border/60 p-4">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">{item.description}</p>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="font-headline text-2xl text-primary">Mantenimiento y evolucion</CardTitle>
                <CardDescription>
                  Recomendaciones para que esta guia y el sistema crezcan de manera ordenada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemGuideEvolution.map((item) => (
                  <article key={item.title} className="rounded-lg border border-border/60 p-4">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">{item.description}</p>
                  </article>
                ))}
              </CardContent>
            </Card>
          </section>

          <Card className="border-accent/40 bg-accent/10 break-inside-avoid">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Observacion final</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-foreground/80">
              <p>
                Esta pagina queda como fuente de referencia dentro de CRApro95 y tambien como base para exportacion a PDF.
              </p>
              <p>
                A medida que el proyecto avance, podemos profundizar esta guia con procedimientos por pantalla, capturas,
                politicas de operacion, historial de versiones y anexos tecnicos.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}

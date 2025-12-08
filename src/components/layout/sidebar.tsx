"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Map,
    Leaf,
    Calendar,
    ClipboardList,
    Users,
    Shield,
    ChevronLeft,
    Settings,
    Tractor,
    Cog,
    ChevronDown,
    Warehouse,
    Wrench,
    Boxes,
    Info,
    Landmark,
    TrendingDown,
    TrendingUp,
    LineChart,
    PieChart,
    Bug,
    BookText,
    History,
    Briefcase,
    ShoppingCart,
    ShoppingBag,
    UserCheck,
    ListTree,
    TestTube,
    Target,
    FileText,
    Monitor,
    AreaChart,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useSidebar } from "@/hooks/use-mobile-sidebar"
import { Logo } from "../icons"
import React from "react"
import { ScrollArea } from "../ui/scroll-area"

const navItems = [
    { 
        title: "Gestión",
        icon: Warehouse,
        links: [
            { href: "/parcelas", icon: Map, label: "Parcelas" },
            { href: "/cultivos", icon: Leaf, label: "Cultivos" },
            { href: "/zafras", icon: Calendar, label: "Zafras" },
        ]
    },
    {
        title: "Operaciones",
        icon: Tractor,
        links: [
            { href: "/dashboard/monitoreo", icon: Monitor, label: "Monitoreo" },
            { href: "/eventos", icon: ClipboardList, label: "Eventos" },
            { href: "/stock", icon: Boxes, label: "Stock" },
            { href: "/maquinaria", icon: Wrench, label: "Maquinaria" },
        ]
    },
    {
        title: "Agronomía",
        icon: Leaf,
        links: [
            { href: "/agronomia/panel", icon: Target, label: "Panel Agronómico" },
            { href: "/agronomia/informe-costos", icon: FileText, label: "Informe de Costos" },
            { href: "/agronomia/plagas", icon: Bug, label: "Plagas" },
            { href: "/agronomia/etapas-cultivo", icon: ListTree, label: "Etapas del Cultivo" },
        ]
    },
    {
        title: "Comercial",
        icon: ShoppingCart,
        links: [
            { href: "/comercial/compras", icon: ShoppingBag, label: "Compras" },
            { href: "/comercial/ventas", icon: TrendingUp, label: "Ventas" },
            { href: "/comercial/proveedores", icon: Users, label: "Proveedores" },
            { href: "/comercial/clientes", icon: Users, label: "Clientes" },
        ]
    },
    {
        title: "Finanzas",
        icon: Landmark,
        links: [
            { href: "/finanzas/dashboard", icon: PieChart, label: "Dashboard" },
            { href: "/finanzas/costos", icon: TrendingDown, label: "Costos" },
            { href: "/finanzas/rentabilidad", icon: LineChart, label: "Rentabilidad" },
        ]
    },
    {
        title: "Contabilidad",
        icon: BookText,
        links: [
            { href: "/contabilidad/plan-de-cuentas", icon: ListTree, label: "Plan de Cuentas" },
            { href: "/contabilidad/centros-de-costo", icon: Landmark, label: "Centros de Costo" },
            { href: "/contabilidad/diario", icon: BookText, label: "Diario" },
            { href: "/contabilidad/mayor", icon: BookText, label: "Mayor" },
        ]
    },
    {
        title: "RRHH",
        icon: Users,
        links: [
            { href: "/rrhh/empleados", icon: Briefcase, label: "Empleados" },
            { href: "/rrhh/asistencias", icon: UserCheck, label: "Asistencias" },
        ]
    },
    {
        title: "Administración",
        icon: Cog,
        links: [
            { href: "/dashboard/general", icon: AreaChart, label: "Dashboard General" },
            { href: "/usuarios", icon: Users, label: "Usuarios" },
            { href: "/roles", icon: Shield, label: "Roles" },
            { href: "/auditoria", icon: History, label: "Auditoría" },
            { href: "/configuracion", icon: Settings, label: "Configuración" },
            { href: "/acerca-de", icon: Info, label: "Acerca de" },
        ]
    }
];

const NavLink = ({ link, isCollapsed, pathname, onLinkClick }: { link: { href: string, icon: React.ElementType, label: string, isComingSoon?: boolean }, isCollapsed: boolean, pathname: string, onLinkClick?: () => void }) => {
  const isActive = pathname.startsWith(link.href) && !link.isComingSoon;
  const isComingSoon = link.isComingSoon;

  return (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isCollapsed ? "justify-center" : "pl-10",
                isComingSoon && "cursor-not-allowed opacity-50"
              )}
              disabled={isComingSoon}
              onClick={onLinkClick}
            >
              <Link href={isComingSoon ? "#" : link.href}>
                <link.icon className="h-5 w-5" />
                {!isCollapsed && <span className="ml-4">{link.label}</span>}
                {isComingSoon && !isCollapsed && <Badge variant="outline" className="ml-auto text-xs">Próximamente</Badge>}
                <span className="sr-only">{link.label}</span>
              </Link>
            </Button>
          </TooltipTrigger>
          {(isCollapsed || isComingSoon) && (
            <TooltipContent side="right">
              {link.label} {isComingSoon && "(Próximamente)"}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
  )
}

export function Sidebar({ isMobile, onLinkClick }: { isMobile?: boolean, onLinkClick?: () => void }) {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [openSections, setOpenSections] = React.useState<string[]>(
    navItems.filter(section => section.links.some(link => pathname.startsWith(link.href) && !link.isComingSoon)).map(s => s.title)
  );

  const finalIsCollapsed = isMobile ? false : isCollapsed;

  if (isMobile) {
    return (
        <ScrollArea className="flex-1">
            <nav className="flex-1 space-y-1 p-2">
                <Button
                    asChild
                    variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                    className={cn("w-full justify-start")}
                    onClick={onLinkClick}
                >
                    <Link href="/dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="ml-4">Dashboard Monitoreo</span>
                    </Link>
                </Button>

                <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
                    {navItems.map(section => (
                        <AccordionItem value={section.title} key={section.title} className="border-b-0">
                            <AccordionTrigger className="py-2 px-3 text-sm font-medium hover:bg-sidebar-accent rounded-md [&[data-state=open]>svg]:rotate-180">
                            <div className="flex items-center gap-4">
                                <section.icon className="h-5 w-5" />
                                {section.title}
                            </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1 pb-0 pl-2">
                                {section.links.map(link => (
                                    <NavLink key={link.href + link.label} link={link} isCollapsed={false} pathname={pathname} onLinkClick={onLinkClick} />
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </nav>
        </ScrollArea>
    )
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        finalIsCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-16 items-center border-b px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-headline text-lg font-bold text-primary">
          <Logo className="h-8 w-8" />
          {!finalIsCollapsed && <span className="text-sidebar-foreground font-bold transition-opacity duration-300">{!finalIsCollapsed && "CRApro95"}</span>}
        </Link>
        {!finalIsCollapsed && (
            <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleSidebar}>
              <ChevronLeft className={cn("h-6 w-6 transition-transform", finalIsCollapsed && "rotate-180")} />
            </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
         <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", finalIsCollapsed && "justify-center")}
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                    {!finalIsCollapsed && <span className="ml-4">Dashboard</span>}
                    <span className="sr-only">Dashboard</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              {finalIsCollapsed && (
                <TooltipContent side="right">
                  Dashboard
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

        {finalIsCollapsed ? (
            navItems.map(section => section.links.map(link => (
                <NavLink key={link.href + link.label} link={link} isCollapsed={finalIsCollapsed} pathname={pathname} />
            )))
        ) : (
            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
                {navItems.map(section => (
                    <AccordionItem value={section.title} key={section.title} className="border-b-0">
                        <AccordionTrigger className="py-2 px-3 text-sm font-medium hover:bg-sidebar-accent rounded-md [&[data-state=open]>svg]:rotate-180">
                           <div className="flex items-center gap-4">
                             <section.icon className="h-5 w-5" />
                             {section.title}
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-0 pl-2">
                            {section.links.map(link => (
                                <NavLink key={link.href + link.label} link={link} isCollapsed={finalIsCollapsed} pathname={pathname} />
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}
      </nav>
      
      <div className="mt-auto p-2 border-t">
         <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button variant="ghost" className={cn("w-full", finalIsCollapsed ? "justify-center" : "justify-start")} onClick={toggleSidebar}>
                    <ChevronLeft className={cn("h-6 w-6 transition-transform", !finalIsCollapsed && "rotate-180")} />
                    {!finalIsCollapsed && <span className="ml-4">Colapsar</span>}
                 </Button>
              </TooltipTrigger>
               {finalIsCollapsed && (
                <TooltipContent side="right">
                  Expandir
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
      </div>

    </aside>
  )
}

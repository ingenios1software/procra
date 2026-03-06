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
  Target,
  FileText,
  Monitor,
  AreaChart,
  Wallet,
  Building,
  BookOpenCheck,
  Clock3,
  ArrowLeftRight,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import type { Permisos } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useSidebar } from "@/hooks/use-mobile-sidebar"
import { Logo } from "../icons"
import React from "react"
import { ScrollArea } from "../ui/scroll-area"

type PermissionKey = keyof Permisos

type NavLinkItem = {
  href: string
  icon: React.ElementType
  label: string
  permission?: PermissionKey
}

type NavSection = {
  title: string
  icon: React.ElementType
  permission?: PermissionKey
  links: NavLinkItem[]
}

const navItems: NavSection[] = [
  {
    title: "Gestión",
    icon: Warehouse,
    permission: "maestros",
    links: [
      { href: "/parcelas", icon: Map, label: "Parcelas" },
      { href: "/cultivos", icon: Leaf, label: "Cultivos" },
      { href: "/zafras", icon: Calendar, label: "Zafras" },
    ],
  },
  {
    title: "Operaciones",
    icon: Tractor,
    permission: "eventos",
    links: [
      { href: "/dashboard/monitoreo", icon: Monitor, label: "Monitoreo", permission: "monitoreos" },
      { href: "/eventos", icon: ClipboardList, label: "Eventos", permission: "eventos" },
      { href: "/stock", icon: Boxes, label: "Stock", permission: "stock" },
      { href: "/maquinaria", icon: Wrench, label: "Maquinaria" },
    ],
  },
  {
    title: "Agronomía",
    icon: Leaf,
    permission: "agronomia",
    links: [
      { href: "/agronomia/panel", icon: Target, label: "Panel Agronómico" },
      { href: "/agronomia/informe-costos", icon: FileText, label: "Informe de Costos" },
      { href: "/agronomia/plagas", icon: Bug, label: "Plagas" },
      { href: "/agronomia/etapas-cultivo", icon: ListTree, label: "Etapas del Cultivo" },
    ],
  },
  {
    title: "Comercial",
    icon: ShoppingCart,
    permission: "ventas",
    links: [
      { href: "/comercial/ventas", icon: TrendingUp, label: "Ventas", permission: "ventas" },
      { href: "/comercial/proveedores", icon: Users, label: "Proveedores" },
      { href: "/comercial/clientes", icon: Users, label: "Clientes" },
    ],
  },
  {
    title: "Facturas",
    icon: FileText,
    permission: "compras",
    links: [
      { href: "/comercial/compras", icon: ShoppingBag, label: "Consulta de Facturas", permission: "compras" },
    ],
  },
  {
    title: "Finanzas",
    icon: Landmark,
    permission: "finanzas",
    links: [
      { href: "/finanzas/dashboard", icon: PieChart, label: "Dashboard" },
      { href: "/finanzas/cuentas-cobrar", icon: Wallet, label: "Ctas por Cobrar" },
      { href: "/finanzas/cuentas-pagar", icon: Wallet, label: "Ctas por Pagar" },
      { href: "/finanzas/tesoreria", icon: ArrowLeftRight, label: "Tesoreria" },
      { href: "/finanzas/costos", icon: TrendingDown, label: "Costos" },
      { href: "/finanzas/rentabilidad", icon: LineChart, label: "Rentabilidad" },
    ],
  },
  {
    title: "Contabilidad",
    icon: BookText,
    permission: "contabilidad",
    links: [
      { href: "/contabilidad/plan-de-cuentas", icon: ListTree, label: "Plan de Cuentas" },
      { href: "/contabilidad/centros-de-costo", icon: Landmark, label: "Centros de Costo" },
      { href: "/contabilidad/balance", icon: Landmark, label: "Balance" },
      { href: "/contabilidad/diario", icon: BookText, label: "Diario" },
      { href: "/contabilidad/mayor", icon: BookText, label: "Mayor" },
    ],
  },
  {
    title: "RRHH",
    icon: Users,
    permission: "rrhh",
    links: [
      { href: "/rrhh/empleados", icon: Briefcase, label: "Empleados" },
      { href: "/rrhh/asistencias", icon: UserCheck, label: "Asistencias" },
      { href: "/rrhh/control-horario", icon: Clock3, label: "Control Horario" },
      { href: "/rrhh/liquidacion", icon: Wallet, label: "Liquidación" },
    ],
  },
  {
    title: "Maestros",
    icon: Building,
    permission: "maestros",
    links: [
      { href: "/maestros/depositos", icon: Warehouse, label: "Depósitos" },
      { href: "/maestros/monedas", icon: Wallet, label: "Monedas" },
      { href: "/maestros/cuentas-caja-banco", icon: Landmark, label: "Ctas Caja/Banco" },
    ],
  },
  {
    title: "Administración",
    icon: Cog,
    permission: "administracion",
    links: [
      { href: "/configuracion/inicial", icon: BookOpenCheck, label: "Checklist Inicial" },
      { href: "/dashboard/general", icon: AreaChart, label: "Dashboard General" },
      { href: "/usuarios", icon: Users, label: "Usuarios" },
      { href: "/roles", icon: Shield, label: "Roles" },
      { href: "/auditoria", icon: History, label: "Auditoría" },
      { href: "/admin", icon: Wrench, label: "Herramientas" },
      { href: "/configuracion", icon: Settings, label: "Configuración" },
      { href: "/configuracion/comercial", icon: Wallet, label: "Empresa / SaaS" },
      { href: "/acerca-de", icon: Info, label: "Acerca de" },
    ],
  },
]

const NavLink = ({
  link,
  isCollapsed,
  pathname,
  onLinkClick,
}: {
  link: NavLinkItem
  isCollapsed: boolean
  pathname: string
  onLinkClick?: () => void
}) => {
  const isActive = pathname.startsWith(link.href)

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant={isActive ? "secondary" : "ghost"}
            className={cn("w-full justify-start", isCollapsed ? "justify-center" : "pl-10")}
            onClick={onLinkClick}
          >
            <Link href={link.href}>
              <link.icon className="h-5 w-5" />
              {!isCollapsed && <span className="ml-4">{link.label}</span>}
              <span className="sr-only">{link.label}</span>
            </Link>
          </Button>
        </TooltipTrigger>
        {isCollapsed && <TooltipContent side="right">{link.label}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  )
}

export function Sidebar({ isMobile, onLinkClick }: { isMobile?: boolean; onLinkClick?: () => void }) {
  const pathname = usePathname()
  const { permisos } = useAuth()
  const { isCollapsed, toggleSidebar } = useSidebar()

  const canView = React.useCallback((permission?: PermissionKey) => {
    if (!permission) return true
    return !!permisos[permission]
  }, [permisos])

  const filteredNavItems = React.useMemo(() => {
    return navItems
      .filter((section) => canView(section.permission))
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => canView(link.permission ?? section.permission)),
      }))
      .filter((section) => section.links.length > 0)
  }, [canView])

  const [openSections, setOpenSections] = React.useState<string[]>(
    filteredNavItems.filter((section) => section.links.some((link) => pathname.startsWith(link.href))).map((s) => s.title)
  )

  React.useEffect(() => {
    const activeSections = filteredNavItems
      .filter((section) => section.links.some((link) => pathname.startsWith(link.href)))
      .map((section) => section.title)
    setOpenSections(activeSections)
  }, [pathname, filteredNavItems])

  const finalIsCollapsed = isMobile ? false : isCollapsed

  const navContent = (
    <>
      <Button
        asChild
        variant={pathname === "/dashboard" ? "secondary" : "ghost"}
        className={cn("w-full justify-start", finalIsCollapsed && "justify-center")}
        onClick={onLinkClick}
      >
        <Link href="/dashboard">
          <LayoutDashboard className="h-5 w-5" />
          {!finalIsCollapsed && <span className="ml-4">Dashboard</span>}
        </Link>
      </Button>

      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
        {filteredNavItems.map((section) => (
          <AccordionItem value={section.title} key={section.title} className="border-b-0">
            <AccordionTrigger className="py-2 px-3 text-sm font-medium hover:bg-sidebar-accent rounded-md [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-4">
                <section.icon className="h-5 w-5" />
                {!finalIsCollapsed && section.title}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-0 pl-2">
              {section.links.map((link) => (
                <NavLink
                  key={link.href + link.label}
                  link={link}
                  isCollapsed={finalIsCollapsed}
                  pathname={pathname}
                  onLinkClick={onLinkClick}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  )

  if (isMobile) {
    return (
      <ScrollArea className="flex-1">
        <nav className="flex-1 space-y-1 p-2">{navContent}</nav>
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
          {!finalIsCollapsed && <span className="text-sidebar-foreground font-bold transition-opacity duration-300">CRApro95</span>}
        </Link>
        {!finalIsCollapsed && (
          <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleSidebar}>
            <ChevronLeft className={cn("h-6 w-6 transition-transform", finalIsCollapsed && "rotate-180")} />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex-1 space-y-1 p-2">
          {finalIsCollapsed ? (
            <TooltipProvider>
              {filteredNavItems.flatMap((section) =>
                section.links.map((link) => (
                  <NavLink key={link.href + link.label} link={link} isCollapsed={true} pathname={pathname} />
                ))
              )}
            </TooltipProvider>
          ) : (
            navContent
          )}
        </nav>
      </ScrollArea>

      <div className="mt-auto p-2 border-t">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn("w-full", finalIsCollapsed ? "justify-center" : "justify-start")}
                onClick={toggleSidebar}
              >
                <ChevronLeft className={cn("h-6 w-6 transition-transform", !finalIsCollapsed && "rotate-180")} />
                {!finalIsCollapsed && <span className="ml-4">Colapsar</span>}
              </Button>
            </TooltipTrigger>
            {finalIsCollapsed && <TooltipContent side="right">Expandir</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}

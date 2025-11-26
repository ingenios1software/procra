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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useSidebar } from "@/hooks/use-mobile-sidebar"
import { Logo } from "../icons"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/parcelas", icon: Map, label: "Parcelas" },
  { href: "/cultivos", icon: Leaf, label: "Cultivos" },
  { href: "/zafras", icon: Calendar, label: "Zafras" },
  { href: "/eventos", icon: ClipboardList, label: "Eventos" },
  { href: "/configuracion", icon: Settings, label: "Configuración" },
  { href: "/usuarios", icon: Users, label: "Usuarios" },
  { href: "/roles", icon: Shield, label: "Roles" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center border-b px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-headline text-lg font-bold text-primary">
          <Logo className="h-8 w-8" />
          {!isCollapsed && <span className="text-sidebar-foreground">CRApro95</span>}
        </Link>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleSidebar}>
          <ChevronLeft className={cn("h-6 w-6 transition-transform", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      <nav className="flex-1 space-y-2 p-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", isCollapsed && "justify-center")}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5" />
                    {!isCollapsed && <span className="ml-4">{item.label}</span>}
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
    </aside>
  )
}

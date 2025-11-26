"use client"

import { Menu } from "lucide-react"
import { Button } from "../ui/button"
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet"
import { Sidebar } from "./sidebar"
import { UserNav } from "./user-nav"
import { useSidebar } from "@/hooks/use-mobile-sidebar"

export function Header() {
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <header className="flex h-16 items-center border-b bg-background px-4 md:px-6">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
             <div className="flex h-16 items-center border-b px-4 shrink-0 bg-sidebar text-sidebar-foreground">
                CRApro95
            </div>
            {/* This is a simplified nav for mobile. A better implementation would reuse the sidebar component logic */}
            <nav className="flex flex-col gap-2 p-4">
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/dashboard">Dashboard</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/parcelas">Parcelas</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/cultivos">Cultivos</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/zafras">Zafras</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/eventos">Eventos</a>
                </Button>
                 <Button asChild variant="ghost" className="justify-start">
                    <a href="/stock">Stock</a>
                </Button>
                 <Button asChild variant="ghost" className="justify-start">
                    <a href="/maquinaria">Maquinaria</a>
                </Button>
                 <Button asChild variant="ghost" className="justify-start">
                    <a href="/finanzas/dashboard">Finanzas</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/usuarios">Usuarios</a>
                </Button>
                 <Button asChild variant="ghost" className="justify-start">
                    <a href="/roles">Roles</a>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                    <a href="/configuracion">Configuración</a>
                </Button>
                 <Button asChild variant="ghost" className="justify-start">
                    <a href="/acerca-de">Acerca de</a>
                </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial">
          {/* Future search bar can go here */}
        </div>
        <UserNav />
      </div>
    </header>
  )
}

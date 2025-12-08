"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "../ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../ui/sheet"
import { Sidebar } from "./sidebar"
import { UserNav } from "./user-nav"
import { Logo } from "../icons"
import { useState } from "react"

export function Header() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <header className="flex h-16 items-center border-b bg-background px-4 md:px-6">
      <div className="md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0 flex flex-col">
             <SheetHeader className="sr-only">
                <SheetTitle>Menú Principal</SheetTitle>
                <SheetDescription>Navegación principal de la aplicación CRApro95</SheetDescription>
             </SheetHeader>
             <div className="flex h-16 items-center border-b px-4 shrink-0 bg-sidebar text-sidebar-foreground">
                <Link href="/dashboard" className="flex items-center gap-2 font-headline text-lg font-bold text-primary" onClick={() => setIsSheetOpen(false)}>
                    <Logo className="h-8 w-8" />
                    <span className="text-sidebar-foreground font-bold">CRApro95</span>
                </Link>
            </div>
            <Sidebar isMobile={true} onLinkClick={() => setIsSheetOpen(false)} />
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

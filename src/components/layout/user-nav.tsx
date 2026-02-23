"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth as useAppAuth } from "@/hooks/use-auth"
import { useAuth as useFirebaseAuth } from "@/firebase"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function UserNav() {
  const { user, role } = useAppAuth()
  const firebaseAuth = useFirebaseAuth()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await firebaseAuth.signOut()
      router.push("/login")
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email || 'anonymous'}.png`} alt={user.nombre} />
            <AvatarFallback>{user.nombre?.charAt(0) || 'A'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.nombre}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            {role && (
              <p className="text-xs leading-none text-muted-foreground pt-1">
                Rol: <span className="font-semibold">{role}</span>
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Cerrando sesi\u00f3n..." : "Cerrar sesi\u00f3n"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

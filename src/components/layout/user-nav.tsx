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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { UserRole } from "@/lib/types"

export function UserNav() {
  const { user, role, setRole } = useAuth()

  if (!user) return null

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email}.png`} alt={user.nombre} />
            <AvatarFallback>{user.nombre.charAt(0)}</AvatarFallback>
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
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cambiar Rol (Demo)</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleRoleChange('admin')} disabled={role === 'admin'}>
            Administrador
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('operador')} disabled={role === 'operador'}>
            Operador
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('consulta')} disabled={role === 'consulta'}>
            Consulta
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

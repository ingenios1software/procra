"use client";

import { useTheme } from "@/context/theme-provider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>
          Personaliza la apariencia de la aplicación. Cambia entre el modo claro
          y oscuro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
              <span>Modo Oscuro</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Activa el tema oscuro para la aplicación.
              </span>
            </Label>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

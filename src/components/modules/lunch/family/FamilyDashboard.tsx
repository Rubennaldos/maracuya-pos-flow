// src/components/modules/lunch/family/FamilyDashboard.tsx
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, History, ArrowRight, Receipt } from "lucide-react";

type FamilyDashboardProps = {
  clientName: string;
  clientCode: string;
  availableModules: {
    pedidos?: { enabled: boolean; name: string };
    consumo?: { enabled: boolean; name: string };
  };
  onModuleSelect: (moduleId: string) => void;
  onViewHistory: () => void;
};

/**
 * Dashboard principal del Portal de Familias
 * Muestra mensaje de bienvenida y módulos disponibles
 */
export default function FamilyDashboard({
  clientName,
  clientCode,
  availableModules,
  onModuleSelect,
  onViewHistory,
}: FamilyDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Mensaje de bienvenida */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">
            ¡Hola, {clientName}!
          </CardTitle>
          <CardDescription className="text-base">
            Código: {clientCode}
          </CardDescription>
        </CardHeader>
      </Card>


      {/* Módulos disponibles */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Módulos disponibles</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Módulo de Pedidos - Siempre visible */}
          <Card 
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all duration-200 group"
            onClick={() => onModuleSelect("pedidos")}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <CardTitle className="mt-4">
                {availableModules.pedidos?.name || "Pedidos de Almuerzo"}
              </CardTitle>
              <CardDescription>
                Realiza tus pedidos de almuerzo para la semana
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Módulo de Detalle de Consumo - Siempre visible */}
          <Card 
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all duration-200 group"
            onClick={() => onModuleSelect("consumo")}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <Receipt className="h-6 w-6 text-secondary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <CardTitle className="mt-4">
                {availableModules.consumo?.name || "Detalle de Consumo"}
              </CardTitle>
              <CardDescription>
                Revisa el historial de consumo y compras
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Placeholder para futuros módulos */}
          <Card className="border-dashed opacity-50">
            <CardHeader>
              <div className="bg-muted p-3 rounded-lg w-fit">
                <div className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-muted-foreground">
                Próximamente
              </CardTitle>
              <CardDescription>
                Más módulos estarán disponibles pronto
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

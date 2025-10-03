// src/components/modules/lunch/family/FamilyDashboard.tsx
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, History, ArrowRight, Receipt, DollarSign } from "lucide-react";
import maintenanceKid from "@/assets/maintenance-kid.jpg";

type FamilyDashboardProps = {
  clientName: string;
  clientCode: string;
  availableModules: {
    pedidos?: { enabled: boolean; name: string };
    consumo?: { enabled: boolean; name: string };
    pagos?: { enabled: boolean; name: string };
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
          {/* Módulo de Pedidos */}
          <Card 
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all duration-200 group"
            onClick={() => onModuleSelect("pedidos")}
          >
            <CardHeader>
              {availableModules.pedidos?.enabled !== false ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <img 
                      src={maintenanceKid} 
                      alt="En mantenimiento" 
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  </div>
                  <CardTitle className="text-center text-muted-foreground">
                    {availableModules.pedidos?.name || "Pedidos de Almuerzo"}
                  </CardTitle>
                  <CardDescription className="text-center">
                    Módulo en mantenimiento
                  </CardDescription>
                </>
              )}
            </CardHeader>
          </Card>

          {/* Módulo de Detalle de Consumo */}
          <Card 
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all duration-200 group"
            onClick={() => onModuleSelect("consumo")}
          >
            <CardHeader>
              {availableModules.consumo?.enabled !== false ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <img 
                      src={maintenanceKid} 
                      alt="En mantenimiento" 
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  </div>
                  <CardTitle className="text-center text-muted-foreground">
                    {availableModules.consumo?.name || "Detalle de Consumo"}
                  </CardTitle>
                  <CardDescription className="text-center">
                    Módulo en mantenimiento
                  </CardDescription>
                </>
              )}
            </CardHeader>
          </Card>

          {/* Módulo de Pagos */}
          <Card 
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all duration-200 group"
            onClick={() => onModuleSelect("pagos")}
          >
            <CardHeader>
              {availableModules.pagos?.enabled !== false ? (
                <>
                  <div className="flex items-start justify-between">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="mt-4">
                    {availableModules.pagos?.name || "Mis Pagos"}
                  </CardTitle>
                  <CardDescription>
                    Gestiona tus pagos y deudas pendientes
                  </CardDescription>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <img 
                      src={maintenanceKid} 
                      alt="En mantenimiento" 
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  </div>
                  <CardTitle className="text-center text-muted-foreground">
                    {availableModules.pagos?.name || "Mis Pagos"}
                  </CardTitle>
                  <CardDescription className="text-center">
                    Módulo en mantenimiento
                  </CardDescription>
                </>
              )}
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

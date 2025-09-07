import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { useSession } from "@/state/session";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  DollarSign, 
  CreditCard,
  FileText,
  Calendar,
  Gift,
  AlertTriangle,
  LogOut,
  Calculator
} from "lucide-react";

export type ModuleType = 
  | 'pos' 
  | 'sales' 
  | 'products' 
  | 'clients' 
  | 'checkout' 
  | 'accounts' 
  | 'historical' 
  | 'promos' 
  | 'unregistered';

interface DashboardProps {
  onModuleSelect: (module: ModuleType) => void;
}

export const Dashboard = ({ onModuleSelect }: DashboardProps) => {
  const { user, logout } = useSession();

  const modules = [
    {
      id: 'pos' as ModuleType,
      title: 'Punto de Venta',
      description: 'Realizar ventas, almuerzos y programadas',
      icon: ShoppingCart,
      color: 'from-primary to-primary-light',
      roles: ['admin', 'cajero']
    },
    {
      id: 'sales' as ModuleType,
      title: 'Lista de Ventas',
      description: 'Ver, editar y eliminar ventas',
      icon: FileText,
      color: 'from-secondary to-secondary-light',
      roles: ['admin', 'cajero']
    },
    {
      id: 'products' as ModuleType,
      title: 'Productos',
      description: 'Gestionar catálogo de productos',
      icon: Package,
      color: 'from-success to-primary-light',
      roles: ['admin']
    },
    {
      id: 'clients' as ModuleType,
      title: 'Clientes',
      description: 'Gestionar base de clientes',
      icon: Users,
      color: 'from-warning to-secondary',
      roles: ['admin', 'cajero']
    },
    {
      id: 'checkout' as ModuleType,
      title: 'Cierre de Caja',
      description: 'Cuadrar ventas del día',
      icon: Calculator,
      color: 'from-primary-dark to-success',
      roles: ['admin', 'cajero']
    },
    {
      id: 'accounts' as ModuleType,
      title: 'Cuentas por Cobrar',
      description: 'Gestionar créditos y cobranzas',
      icon: CreditCard,
      color: 'from-destructive to-warning',
      roles: ['admin', 'cobranzas']
    },
    {
      id: 'historical' as ModuleType,
      title: 'Ventas Históricas',
      description: 'Registrar ventas anteriores',
      icon: Calendar,
      color: 'from-muted-foreground to-primary',
      roles: ['admin']
    },
    {
      id: 'promos' as ModuleType,
      title: 'Promociones',
      description: 'Crear combos y ofertas',
      icon: Gift,
      color: 'from-secondary-dark to-warning',
      roles: ['admin']
    },
    {
      id: 'unregistered' as ModuleType,
      title: 'Ventas No Registradas',
      description: 'Recuperar ventas con errores',
      icon: AlertTriangle,
      color: 'from-destructive to-secondary',
      roles: ['admin']
    }
  ];

  const userModules = modules.filter(module => 
    module.roles.includes(user?.role || 'cajero')
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={logout}
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Panel de Control
          </h2>
          <p className="text-muted-foreground">
            Seleccione el módulo que desea utilizar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card 
                key={module.id}
                className="group cursor-pointer transition-all duration-300 hover:shadow-medium hover:scale-105 border-border/50"
                onClick={() => onModuleSelect(module.id)}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${module.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-lg text-foreground group-hover:text-primary transition-colors">
                    {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};
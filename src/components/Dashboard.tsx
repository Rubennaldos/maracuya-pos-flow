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
  Calculator,
  Trash2,
  UtensilsCrossed,
  Bot, // 👈 NUEVO: icono para el ChatBot
  MessageCircle, // 👈 NUEVO: icono para WhatsApp Business
} from "lucide-react";

export type ModuleType =
  | "pos"
  | "sales"
  | "products"
  | "clients"
  | "checkout"
  | "accounts"
  | "historical"
  | "promos"
  | "unregistered"
  | "deleted"
  | "lunch-admin"
  | "chatbot"
  | "whatsapp-business"; // 👈 NUEVO: módulo WhatsApp Business

interface DashboardProps {
  onModuleSelect: (module: ModuleType) => void;
}

export const Dashboard = ({ onModuleSelect }: DashboardProps) => {
  const { user, logout } = useSession();

  const modules = [
    {
      id: "pos" as ModuleType,
      title: "Punto de Venta",
      description: "Realizar ventas, almuerzos y programadas",
      icon: ShoppingCart,
      color: "from-primary to-primary-light",
      roles: ["admin", "cajero"],
    },
    {
      id: "sales" as ModuleType,
      title: "Lista de Ventas",
      description: "Ver, editar y eliminar ventas",
      icon: FileText,
      color: "from-secondary to-secondary-light",
      roles: ["admin", "cajero"],
    },
    {
      id: "products" as ModuleType,
      title: "Productos",
      description: "Gestionar catálogo de productos",
      icon: Package,
      color: "from-success to-primary-light",
      roles: ["admin"],
    },
    {
      id: "clients" as ModuleType,
      title: "Clientes",
      description: "Gestionar base de clientes",
      icon: Users,
      color: "from-warning to-secondary",
      roles: ["admin", "cajero"],
    },
    {
      id: "checkout" as ModuleType,
      title: "Cierre de Caja",
      description: "Cuadrar ventas del día",
      icon: Calculator,
      color: "from-primary-dark to-success",
      roles: ["admin", "cajero"],
    },
    {
      id: "accounts" as ModuleType,
      title: "Cuentas por Cobrar",
      description: "Gestionar créditos y cobranzas",
      icon: CreditCard,
      color: "from-destructive to-warning",
      roles: ["admin", "cobranzas"],
    },
    {
      id: "historical" as ModuleType,
      title: "Ventas Históricas",
      description: "Registrar ventas anteriores",
      icon: Calendar,
      color: "from-muted-foreground to-primary",
      roles: ["admin"],
    },
    {
      id: "promos" as ModuleType,
      title: "Promociones",
      description: "Crear combos y ofertas",
      icon: Gift,
      color: "from-secondary-dark to-warning",
      roles: ["admin"],
    },
    {
      id: "unregistered" as ModuleType,
      title: "Ventas No Registradas",
      description: "Recuperar ventas con errores",
      icon: AlertTriangle,
      color: "from-destructive to-secondary",
      roles: ["admin"],
    },
    {
      id: "deleted" as ModuleType,
      title: "Historial de Eliminados",
      description: "Papelera de ventas eliminadas",
      icon: Trash2,
      color: "from-muted to-muted-foreground",
      roles: ["admin"],
    },
    {
      id: "lunch-admin" as ModuleType,
      title: "Administrar Almuerzos",
      description: "Gestionar menú y pedidos de almuerzos",
      icon: UtensilsCrossed,
      color: "from-warning to-primary",
      roles: ["admin"],
    },
    // 👇 NUEVO: tarjeta del ChatBot
    {
      id: "chatbot" as ModuleType,
      title: "ChatBot",
      description:
        "Asistente para clientes, deudores, ventas y productos",
      icon: Bot,
      color: "from-indigo-500 to-sky-400",
      roles: ["admin", "cajero", "cobranzas"],
    },
    // 👇 NUEVO: tarjeta de WhatsApp Business
    {
      id: "whatsapp-business" as ModuleType,
      title: "WhatsApp Business",
      description:
        "Gestionar conversaciones y respuestas automáticas",
      icon: MessageCircle,
      color: "from-green-500 to-emerald-400",
      roles: ["admin", "cajero", "cobranzas"],
    },
  ];

  const userModules = modules.filter((module) =>
    module.roles.includes(user?.role || "cajero")
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
              <p className="text-sm text-muted-foreground capitalize">
                {user?.role}
              </p>
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
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Panel de Control
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Seleccione el módulo que desea utilizar
          </p>
        </div>

        {/* Mobile: Circular Bubbles */}
        <div className="grid grid-cols-3 gap-4 md:hidden">
          {userModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => onModuleSelect(module.id)}
                className="group flex flex-col items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl p-2 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${module.color} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}
                >
                  <IconComponent className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-foreground text-center leading-tight px-1">
                  {module.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop/Tablet: Card Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {userModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card
                key={module.id}
                className="group cursor-pointer transition-all duration-300 hover:shadow-medium hover:scale-105 border-border/50 overflow-hidden"
                onClick={() => onModuleSelect(module.id)}
              >
                <CardHeader className="text-center pb-3 pt-6">
                  <div
                    className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${module.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}
                  >
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-base lg:text-lg text-foreground group-hover:text-primary transition-colors">
                    {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center pb-6">
                  <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2">
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

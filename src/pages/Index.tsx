import { useState, useEffect } from "react";
import { useSession } from "@/state/session";
import { RTDBLogin } from "@/components/modules/RTDBLogin";
import { Dashboard, ModuleType } from "@/components/Dashboard";
import { PointOfSale } from "@/components/modules/PointOfSale";
import { SalesList } from "@/components/modules/SalesList";
import { Products } from "@/components/modules/Products";
import { Clients } from "@/components/modules/Clients";
import { Checkout } from "@/components/modules/Checkout";
import { AccountsReceivable } from "@/components/modules/AccountsReceivable";
import { HistoricalSales } from "@/components/modules/HistoricalSales";
import { Promotions } from "@/components/modules/Promotions";
import { UnregisteredSales } from "@/components/modules/UnregisteredSales";
import { DeletedSalesHistory } from "@/components/modules/DeletedSalesHistory";
import LunchAdmin from "@/components/modules/LunchAdmin";

const Index = () => {
  const { isAuthenticated } = useSession();
  const [currentModule, setCurrentModule] = useState<ModuleType | null>(null);

  console.log('Index component loaded, isAuthenticated:', isAuthenticated);

  if (!isAuthenticated) {
    console.log('Not authenticated, showing RTDBLogin');
    return <RTDBLogin />;
  }

  if (currentModule === 'pos') {
    return <PointOfSale onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'sales') {
    return <SalesList onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'products') {
    return <Products onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'clients') {
    return <Clients onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'checkout') {
    return <Checkout onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'accounts') {
    return <AccountsReceivable onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'historical') {
    return <HistoricalSales onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'promos') {
    return <Promotions onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'unregistered') {
    return <UnregisteredSales onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'deleted') {
    return <DeletedSalesHistory onBack={() => setCurrentModule(null)} />;
  }

  if (currentModule === 'lunch-admin') {
    return <LunchAdmin onBack={() => setCurrentModule(null)} />;
  }

  // Other modules still in development
  if (currentModule) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Módulo: {currentModule}</h1>
          <p className="text-muted-foreground mb-4">En desarrollo...</p>
          <button 
            onClick={() => setCurrentModule(null)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard onModuleSelect={setCurrentModule} />;
};

export default Index;

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard, ModuleType } from "@/components/Dashboard";
import { PointOfSale } from "@/components/modules/PointOfSale";

const Index = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [currentModule, setCurrentModule] = useState<ModuleType | null>(null);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (currentModule === 'pos') {
    return <PointOfSale onBack={() => setCurrentModule(null)} />;
  }

  // Add other modules here as they are implemented
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

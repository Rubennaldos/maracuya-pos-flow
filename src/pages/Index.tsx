// src/pages/Index.tsx
import { useState } from "react";
import { useSession } from "@/state/session";
import RTDBLogin from "@/components/modules/RTDBLogin";

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

// 👇 IMPORTA el módulo de almuerzos (admin)
import LunchAdmin from "@/components/modules/LunchAdmin";

export default function Index() {
  const { isAuthenticated } = useSession();
  const [currentModule, setCurrentModule] = useState<ModuleType | null>(null);

  const FAMILIAS_URL = `${import.meta.env.BASE_URL}#/familias`;

  const DebugBar = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "#111",
        color: "#0f0",
        fontSize: 12,
        padding: "6px 10px",
        zIndex: 9999,
      }}
    >
      base={import.meta.env.BASE_URL} • auth={String(isAuthenticated)} • module=
      {String(currentModule ?? "dashboard")}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <>
        {DebugBar}
        <RTDBLogin />
        <noscript>
          <div style={{ padding: 24 }}>Cargando login…</div>
        </noscript>
      </>
    );
  }

  if (currentModule === "pos") return <PointOfSale onBack={() => setCurrentModule(null)} />;
  if (currentModule === "sales") return <SalesList onBack={() => setCurrentModule(null)} />;
  if (currentModule === "products") return <Products onBack={() => setCurrentModule(null)} />;
  if (currentModule === "clients") return <Clients onBack={() => setCurrentModule(null)} />;
  if (currentModule === "checkout") return <Checkout onBack={() => setCurrentModule(null)} />;
  if (currentModule === "accounts") return <AccountsReceivable onBack={() => setCurrentModule(null)} />;
  if (currentModule === "historical") return <HistoricalSales onBack={() => setCurrentModule(null)} />;
  if (currentModule === "promos") return <Promotions onBack={() => setCurrentModule(null)} />;
  if (currentModule === "unregistered") return <UnregisteredSales onBack={() => setCurrentModule(null)} />;
  if (currentModule === "deleted") return <DeletedSalesHistory onBack={() => setCurrentModule(null)} />;

  // 👇 ESTE ES EL CASE QUE FALTABA
  if (currentModule === "lunch-admin") return <LunchAdmin onBack={() => setCurrentModule(null)} />;


  return (
    <>
      {DebugBar}

      <section className="w-full bg-green-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center">
          <h2 className="text-lg md:text-xl font-bold">🍽️ ¡Padres de Familia!</h2>
          <p className="opacity-90">Ordena el almuerzo de tu hijo de forma fácil y rápida</p>
          <div className="mt-3">
            <a
              href={FAMILIAS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-lg bg-white/95 text-green-700 px-4 py-2 font-medium shadow hover:bg-white"
            >
              Ir a Almuerzos y Pedidos
            </a>
          </div>
        </div>
      </section>

      <Dashboard onModuleSelect={setCurrentModule} />
    </>
  );
}

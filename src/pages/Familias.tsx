// src/pages/Familias.tsx
import React, { useEffect, useMemo, useState } from "react";
import FamilyLogin from "@/components/modules/FamilyLogin";
import FamilyMenu from "@/components/modules/FamilyMenu";

type LoggedClient = {
  code: string;
  name: string;
};

const STORAGE_KEY = "family_portal_client";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export default function Familias() {
  const [client, setClient] = useState<LoggedClient | null>(null);
  const [hydrated, setHydrated] = useState(false); // evita parpadeos en SSR/SPA

  // Cargar sesión persistida
  useEffect(() => {
    if (!isBrowser()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LoggedClient;
        if (parsed && typeof parsed.code === "string" && parsed.code.trim()) {
          setClient({ code: parsed.code.trim(), name: (parsed.name || "").trim() });
        }
      }
    } catch {
      // si hay JSON inválido, limpiamos
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  const handleLogged = (c: LoggedClient) => {
    const clean: LoggedClient = { code: c.code.trim(), name: (c.name || "").trim() };
    setClient(clean);
    if (isBrowser()) localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  };

  const handleLogout = () => {
    setClient(null);
    if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
  };

  const greeting = useMemo(
    () => (client ? `¡Bienvenidos, papitos de ${client.name}!` : "Portal de Familias"),
    [client]
  );

  // Evita render hasta hidratar (no ver “login” un instante si ya hay sesión)
  if (!hydrated) return null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <header
        style={{
          background: "#e8f5e9",
          border: "1px solid #c8e6c9",
          padding: "14px 16px",
          borderRadius: 12,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>{greeting}</h1>

        {client && (
          <button
            onClick={handleLogout}
            type="button"
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
            aria-label="Salir del portal"
          >
            Salir
          </button>
        )}
      </header>

      {!client ? (
        <FamilyLogin onLogged={handleLogged} />
      ) : (
        <FamilyMenu client={client} onLogout={handleLogout} />
      )}

      <footer style={{ textAlign: "center", marginTop: 28, color: "#6b7280", fontSize: 12 }}>
        Maracuyá • Portal de Almuerzos
      </footer>
    </div>
  );
}

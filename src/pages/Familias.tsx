// src/pages/Familias.tsx
import { useEffect, useMemo, useState } from "react";
import FamilyLogin from "../components/modules/FamilyLogin";
import FamilyMenu  from "../components/modules/FamilyMenu";

type LoggedClient = {
  code: string;
  name: string;
};

const STORAGE_KEY = "family_portal_client";

export default function Familias() {
  const [client, setClient] = useState<LoggedClient | null>(null);

  // Cargar de localStorage para sesión persistente
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LoggedClient;
        if (parsed?.code) setClient(parsed);
      } catch {}
    }
  }, []);

  const handleLogged = (c: LoggedClient) => {
    setClient(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  };

  const handleLogout = () => {
    setClient(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const greeting = useMemo(
    () => (client ? `¡Bienvenidos papitos de ${client.name}!` : "Portal de Familias"),
    [client]
  );

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
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        )}
      </header>

      {!client ? (
        <FamilyLogin onLogged={handleLogged} />
      ) : (
        <FamilyMenu client={client} />
      )}

      <footer style={{ textAlign: "center", marginTop: 28, color: "#6b7280", fontSize: 12 }}>
        Maracuyá • Portal de Almuerzos
      </footer>
    </div>
  );
}

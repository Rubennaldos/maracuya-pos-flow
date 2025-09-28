import React, { useEffect, useMemo, useState } from "react";
import FamilyLogin from "@/components/modules/FamilyLogin";
import FamilyMenuWithDays from "@/components/modules/FamilyMenuWithDays";

type LoggedClient = {
  code: string;
  name: string; // se sigue guardando para retro-compatibilidad, pero FamilyMenu ya no lo usa
};

const STORAGE_KEY = "family_portal_client";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export default function Familias() {
  const [client, setClient] = useState<LoggedClient | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
    // Cabecera solo cuando NO hay sesión
    () => (!client ? "Portal de Familias" : ""),
    [client]
  );

  if (!hydrated) return null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header SOLO en pantalla de login (evita doble bienvenida) */}
      {!client && (
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
        </header>
      )}

      {!client ? (
        <FamilyLogin onLogged={handleLogged} />
      ) : (
        // Pasamos SOLO el code para que FamilyMenuWithDays resuelva el nombre real desde RTDB
        <FamilyMenuWithDays client={{ code: client.code }} onLogout={handleLogout} />
      )}

      <footer style={{ textAlign: "center", marginTop: 28, color: "#6b7280", fontSize: 12 }}>
        Maracuyá • Portal de Almuerzos
      </footer>
    </div>
  );
}

// src/pages/Familias.tsx
import React, { useEffect, useMemo, useState } from "react";
import FamilyLogin from "@/components/modules/FamilyLogin";
import FamilyMenuWithDays from "@/components/modules/FamilyMenuWithDays";
import MaintenancePage from "@/components/ui/MaintenancePage";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type LoggedClient = {
  code: string;
  name: string; // se guarda por compatibilidad; FamilyMenuWithDays puede resolver nombre real
};

const STORAGE_KEY = "family_portal_client";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export default function Familias() {
  const [client, setClient] = useState<LoggedClient | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [portalOpen, setPortalOpen] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState<string>("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // --- NUEVO: flags por querystring
  const params = isBrowser() ? new URLSearchParams(window.location.search) : null;
  const shouldAutologin = params?.get("autologin") === "1"; // por defecto NO auto-loguea
  const forceLogout = params?.get("logout") === "1";

  // Si viene ?logout=1, limpiamos la sesión guardada
  useEffect(() => {
    if (!isBrowser()) return;
    if (forceLogout) {
      localStorage.removeItem(STORAGE_KEY);
      setClient(null);
      // Opcional: limpiar el query para que no quede
      const url = new URL(window.location.href);
      url.searchParams.delete("logout");
      history.replaceState({}, "", url.toString());
    }
  }, [forceLogout]);

  // Cargar configuración del portal
  useEffect(() => {
    const loadPortalSettings = async () => {
      try {
        const settings = await RTDBHelper.getData<any>(RTDB_PATHS.lunch_settings);
        setPortalOpen(settings?.isOpen ?? true);
        setWhatsappPhone(settings?.whatsapp?.phone || "");
      } catch (error) {
        console.error("Error loading portal settings:", error);
        setPortalOpen(true); // Por defecto abierto si hay error
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadPortalSettings();
  }, []);

  // Cargar sesión persistida SOLO si ?autologin=1
  useEffect(() => {
    if (!isBrowser()) return;
    if (!shouldAutologin) {
      setHydrated(true);
      return;
    }
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
  }, [shouldAutologin]);

  const handleLogged = (c: LoggedClient) => {
    const clean: LoggedClient = { code: c.code.trim(), name: (c.name || "").trim() };
    setClient(clean);
    // Si en el futuro quieres recordar sesión, descomenta la siguiente línea
    // localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
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

  if (!hydrated || !settingsLoaded) return null;

  // Si el portal está cerrado, mostrar página de mantenimiento
  if (!portalOpen) {
    return <MaintenancePage whatsappPhone={whatsappPhone} />;
  }

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

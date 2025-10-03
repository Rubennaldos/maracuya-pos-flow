// src/pages/Familias.tsx
import React, { useEffect, useMemo, useState } from "react";
import FamilyLogin from "@/components/modules/FamilyLogin";
import PedidosModule from "@/components/modules/lunch/family/PedidosModule";
import MaintenancePage from "@/components/ui/MaintenancePage";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type LoggedClient = {
  code: string;
  name: string; // compat, el nombre real puede resolverse en FamilyMenuWithDays
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
  const [portalModules, setPortalModules] = useState({
    portalEnabled: true,
    pedidos: { enabled: true, name: "Pedidos de Almuerzo" },
  });

  // Cargar configuración del portal
  useEffect(() => {
    const loadPortalSettings = async () => {
      try {
        const settings = await RTDBHelper.getData<any>(RTDB_PATHS.lunch_settings);
        setPortalOpen(settings?.isOpen ?? true);
        setWhatsappPhone(settings?.whatsapp?.phone || "");
        
        // Cargar módulos del portal
        const modulesData = await RTDBHelper.getData<any>("family_portal_modules");
        if (modulesData) {
          setPortalModules(modulesData);
        }
      } catch (error) {
        console.error("Error loading portal settings:", error);
        setPortalOpen(true);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadPortalSettings();
  }, []);

  // Cargar sesión guardada del dispositivo (no aceptamos ?code= en URL)
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

  // Login normal
  const handleLogged = (c: LoggedClient) => {
    const clean: LoggedClient = { code: c.code.trim(), name: (c.name || "").trim() };
    setClient(clean);
    if (isBrowser()) localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  };

  // Logout (botón "Salir de perfil")
  const handleLogout = () => {
    setClient(null);
    if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
  };

  const headingText = useMemo(() => "Portal de Familias", []);

  if (!hydrated || !settingsLoaded) return null;

  // Mostrar página de mantenimiento si el portal está cerrado o deshabilitado
  if (!portalOpen || !portalModules.portalEnabled) {
    return <MaintenancePage whatsappPhone={whatsappPhone} />;
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header SIEMPRE visible. Cuando hay sesión, muestra botón "Salir de perfil" */}
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
        <h1 style={{ margin: 0, fontSize: 18 }}>{headingText}</h1>

        {client ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#166534" }}>
              Sesión de <strong>{client.name || client.code}</strong> ({client.code})
            </span>
            <button
              onClick={handleLogout}
              type="button"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #dc2626",
                background: "#fee2e2",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Salir de perfil
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#166534" }}>
            Ingresa tu código para continuar
          </span>
        )}
      </header>

      {!client ? (
        <FamilyLogin onLogged={handleLogged} />
      ) : (
        // Mostrar módulos habilitados según configuración
        <div className="space-y-4">
          {portalModules.pedidos?.enabled ? (
            <PedidosModule client={{ code: client.code }} onLogout={handleLogout} />
          ) : (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Módulo no disponible</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    El módulo de pedidos no está disponible en este momento.
                  </p>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full"
                  >
                    Salir de perfil
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <footer style={{ textAlign: "center", marginTop: 28, color: "#6b7280", fontSize: 12 }}>
        Maracuyá • Portal de Almuerzos
      </footer>
    </div>
  );
}

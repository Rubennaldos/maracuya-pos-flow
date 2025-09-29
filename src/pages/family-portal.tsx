import React from "react";
import FamilyPortalApp from "@/components/modules/lunch/family/FamilyPortalApp";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/**
 * Lee ?code= y ?name= de la URL para identificar al cliente.
 * Si no vienen, usa un fallback. Puedes reemplazar esto por tu sesión/login.
 */
function useClientFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("code") || "C169111";
  const name = params.get("name") || "Jethro Shumann";
  return { id, name };
}

export default function FamilyPortalPage() {
  const client = useClientFromQuery();

  // Guardado real en RTDB (puedes moverlo a un servicio si prefieres)
  const saveOrder = async (payload: any) => {
    const id =
      (globalThis.crypto && "randomUUID" in globalThis.crypto)
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    await RTDBHelper.updateData({
      // pedido completo
      [`${RTDB_PATHS.lunch_orders}/${id}`]: { id, ...payload },
      // índice por cliente
      [`lunch_orders_by_client/${payload.clientCode}/${id}`]: true,
    });
  };

  return (
    <FamilyPortalApp
      mode="live"
      client={client}
      onPlaceOrder={saveOrder}
      // whatsappPhoneOverride="51XXXXXXXXX" // opcional si quieres forzar número
    />
  );
}

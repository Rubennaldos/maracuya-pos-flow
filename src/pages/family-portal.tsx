import React from "react";
import FamilyPortalApp from "@/components/modules/lunch/family/FamilyPortalApp";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

export default function FamilyPortalPage() {
  const client = { id: "C169111", name: "Jethro Shumann" };

  const saveOrder = async (payload: any) => {
    const id = (globalThis.crypto?.randomUUID?.() ?? `ord_${Date.now()}`);
    await RTDBHelper.updateData({
      [`${RTDB_PATHS.lunch_orders}/${id}`]: { id, ...payload },
      [`lunch_orders_by_client/${payload.clientCode}/${id}`]: true,
    });
  };

  return (
    <FamilyPortalApp
      mode="live"
      client={client}
      onPlaceOrder={saveOrder}
      // whatsappPhoneOverride="51XXXXXXXXX" // opcional
    />
  );
}

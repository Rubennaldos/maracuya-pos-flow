import React from "react";
import FamilyPortalApp from "@/components/modules/lunch/family/FamilyPortalApp";

export default function FamilyPortalPreview() {
  return (
    <FamilyPortalApp
      mode="preview"
      client={{ id: "DEMO001", name: "Usuario de Prueba" }}
      // whatsappPhoneOverride="51XXXXXXXXX" // si quieres forzar un número en DEMO
    />
  );
}

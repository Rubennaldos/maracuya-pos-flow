"use client";

import React from "react";
import FamilyPortalApp from "@/components/modules/lunch/family/FamilyPortalApp";

/**
 * Vista previa del Portal de Familias para administración.
 * - Modo "preview": no guarda en base de datos.
 * - Usa un cliente de demostración.
 * - Puedes forzar un número de WhatsApp con `whatsappPhoneOverride` si quieres probar el envío.
 */
export default function FamilyPortalPreview() {
  return (
    <FamilyPortalApp
      mode="preview"
      client={{ id: "DEMO001", name: "Usuario de Prueba" }}
      // whatsappPhoneOverride="51XXXXXXXXX" // opcional: fuerza el número de WhatsApp en la preview
    />
  );
}

// src/components/modules/lunch/family/PedidosModule.tsx
import React from "react";
import FamilyMenuWithDays from "@/components/modules/FamilyMenuWithDays";

type PedidosModuleProps = {
  client: { code: string; name?: string };
  onLogout: () => void;
};

/**
 * Módulo de Pedidos para el Portal de Familias
 * Envuelve toda la funcionalidad de pedidos de almuerzo
 */
export default function PedidosModule({ client, onLogout }: PedidosModuleProps) {
  return <FamilyMenuWithDays client={client} onLogout={onLogout} />;
}

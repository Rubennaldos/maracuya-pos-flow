import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import OrdersByDayView from "@/components/modules/lunch/history/OrdersByDayView";

export default function HistorialPedidos() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            Historial de Pedidos
          </CardTitle>
          <p className="text-muted-foreground">
            Gestiona y consulta todos los pedidos organizados por días. 
            Filtra por fechas, genera reportes y mantén el control total de tu negocio.
          </p>
        </CardHeader>
        <CardContent>
          <OrdersByDayView />
        </CardContent>
      </Card>
    </div>
  );
}
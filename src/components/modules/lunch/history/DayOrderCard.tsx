import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Trash2,
  Printer,
  Hash
} from "lucide-react";
import type { DayOrders, HistoryOrder } from "./types";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timestamp: number | string) => {
  const t = typeof timestamp === "number" ? timestamp : Date.parse(String(timestamp || 0));
  const dt = new Date(Number.isFinite(t) ? t : Date.now());
  return dt.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface DayOrderCardProps {
  dayOrders: DayOrders;
  onMarkDelivered: (order: HistoryOrder) => void;
  onDeleteOrder: (order: HistoryOrder) => void;
  onPrintDay: (dayOrders: DayOrders) => void;
}

export default function DayOrderCard({
  dayOrders,
  onMarkDelivered,
  onDeleteOrder,
  onPrintDay,
}: DayOrderCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "delivered":
        return "default";
      case "preparing":
      case "ready":
        return "secondary";
      case "canceled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600";
      case "preparing":
        return "text-yellow-600";
      case "ready":
        return "text-blue-600";
      case "canceled":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {formatDate(dayOrders.date)}
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {dayOrders.totalOrders} pedidos
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              {PEN(dayOrders.totalAmount)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPrintDay(dayOrders)}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {dayOrders.orders.map((order) => (
          <Card key={order.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              {/* Order header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">
                      {order.clientName || order.studentName || "Cliente"}
                    </div>
                    <Badge variant="secondary" title="Código de pedido">
                      <Hash className="h-3 w-3 mr-1" />
                      {order.code || order.id.slice(-6)}
                    </Badge>
                  </div>
                  {order.clientCode && (
                    <div className="text-xs text-muted-foreground">
                      Código cliente: {order.clientCode}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(order.status)}>
                    {order.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Hora de creación del pedido">
                    <Clock className="h-3 w-3" />
                    {formatTime(order.createdAt)}
                  </div>
                </div>
              </div>

              {/* Order details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium mb-1">Productos:</div>
                  {order.items?.map((item, index) => (
                    <div key={index} className="ml-3 text-muted-foreground">
                      • {item.qty} x {item.name}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {order.studentName && (
                    <div>
                      <span className="font-medium">Alumno:</span>
                      <span className="ml-2 text-muted-foreground">{order.studentName}</span>
                    </div>
                  )}
                  {order.recess && (
                    <div>
                      <span className="font-medium">Recreo:</span>
                      <span className="ml-2 text-muted-foreground">{order.recess}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Fecha del pedido:</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(typeof order.createdAt === "number" ? order.createdAt : Date.parse(String(order.createdAt || Date.now()))).toLocaleDateString("es-PE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit"
                      })}
                    </span>
                  </div>
                  {order.selectedDays && order.selectedDays.length > 0 && (
                    <div>
                      <span className="font-medium">Días seleccionados:</span>
                      <span className="ml-2 text-muted-foreground">
                        {order.selectedDays.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {order.note && (
                <div className="mt-3 text-sm">
                  <span className="font-medium">Observaciones:</span>
                  <p className="ml-3 text-muted-foreground">{order.note}</p>
                </div>
              )}

              {/* Order footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="font-bold">Total: {PEN(order.total)}</div>
                <div className="flex gap-2">
                  {order.status !== "delivered" && order.status !== "canceled" && (
                    <Button
                      size="sm"
                      onClick={() => onMarkDelivered(order)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Entregar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteOrder(order)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
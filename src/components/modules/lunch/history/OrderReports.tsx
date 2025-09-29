import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  CalendarDays,
} from "lucide-react";
import type { DayOrders } from "./types";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number.isFinite(n) ? n : 0
  );

type StatusKey =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "canceled"
  | "confirmed";

interface OrderReportsProps {
  dayOrders: DayOrders[];
  dateRange: { from: string; to: string };
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export default function OrderReports({
  dayOrders,
  dateRange,
  onExportCSV,
  onExportPDF,
}: OrderReportsProps) {
  // Summary
  const { totalOrders, totalAmount, averageOrderValue } = React.useMemo(() => {
    const orders = dayOrders.reduce((sum, d) => sum + d.totalOrders, 0);
    const amount = dayOrders.reduce((sum, d) => sum + d.totalAmount, 0);
    return {
      totalOrders: orders,
      totalAmount: amount,
      averageOrderValue: orders > 0 ? amount / orders : 0,
    };
  }, [dayOrders]);

  // Orders by status
  const ordersByStatus = React.useMemo(() => {
    const acc: Record<StatusKey, number> = {
      pending: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      canceled: 0,
      confirmed: 0,
    };
    for (const day of dayOrders) {
      for (const order of day.orders) {
        const key = (order.status ?? "pending") as StatusKey;
        acc[key] = (acc[key] ?? 0) + 1;
      }
    }
    return acc;
  }, [dayOrders]);

  // Top clients
  const topClients = React.useMemo(() => {
    const map = new Map<string, { orders: number; amount: number }>();
    for (const day of dayOrders) {
      for (const order of day.orders) {
        const name = order.clientName || order.studentName || "Cliente desconocido";
        const prev = map.get(name) ?? { orders: 0, amount: 0 };
        prev.orders += 1;
        prev.amount += order.total || 0;
        map.set(name, prev);
      }
    }
    return Array.from(map, ([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [dayOrders]);

  // Daily performance
  const dailyPerformance = React.useMemo(
    () =>
      dayOrders.map((d) => ({
        date: d.date,
        orders: d.totalOrders,
        amount: d.totalAmount,
        average: d.totalOrders > 0 ? d.totalAmount / d.totalOrders : 0,
      })),
    [dayOrders]
  );

  const getStatusColor = (status: StatusKey | string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "preparing":
        return "bg-yellow-100 text-yellow-800";
      case "ready":
        return "bg-blue-100 text-blue-800";
      case "canceled":
        return "bg-red-100 text-red-800";
      case "confirmed":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con rango de fechas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reportes
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>
                {dateRange.from || "—"} &nbsp;→&nbsp; {dateRange.to || "—"}
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={onExportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={onExportPDF} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total de pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{PEN(totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Ingresos totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{PEN(averageOrderValue)}</p>
                <p className="text-xs text-muted-foreground">Valor promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{dayOrders.length}</p>
                <p className="text-xs text-muted-foreground">Días con pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders by status */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos por estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <Badge key={status} className={getStatusColor(status)}>
                {status}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top clients */}
      <Card>
        <CardHeader>
          <CardTitle>Top clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topClients.map((client, index) => (
              <div
                key={client.name}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <span className="font-medium">{client.name}</span>
                </div>
                <div className="text-right text-sm">
                  <div>{client.orders} pedidos</div>
                  <div className="text-muted-foreground">
                    {PEN(client.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily performance */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento diario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dailyPerformance.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="font-medium">
                  {new Date(day.date + "T00:00:00").toLocaleDateString(
                    "es-PE",
                    { weekday: "short", day: "numeric", month: "short" }
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{day.orders} pedidos</span>
                  <span className="text-muted-foreground">
                    {PEN(day.amount)}
                  </span>
                  <span className="text-muted-foreground">
                    Prom: {PEN(day.average)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

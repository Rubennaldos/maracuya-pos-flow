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
  DollarSign
} from "lucide-react";
import type { DayOrders, OrderReport } from "./types";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

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
  // Calculate summary statistics
  const totalOrders = dayOrders.reduce((sum, day) => sum + day.totalOrders, 0);
  const totalAmount = dayOrders.reduce((sum, day) => sum + day.totalAmount, 0);
  const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

  // Calculate orders by status
  const ordersByStatus = dayOrders.reduce((acc, day) => {
    day.orders.forEach(order => {
      acc[order.status] = (acc[order.status] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // Calculate top clients
  const clientStats = dayOrders.reduce((acc, day) => {
    day.orders.forEach(order => {
      const clientName = order.clientName || order.studentName || "Cliente desconocido";
      if (!acc[clientName]) {
        acc[clientName] = { orders: 0, amount: 0 };
      }
      acc[clientName].orders += 1;
      acc[clientName].amount += order.total;
    });
    return acc;
  }, {} as Record<string, { orders: number; amount: number }>);

  const topClients = Object.entries(clientStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Daily performance
  const dailyPerformance = dayOrders.map(day => ({
    date: day.date,
    orders: day.totalOrders,
    amount: day.totalAmount,
    average: day.totalOrders > 0 ? day.totalAmount / day.totalOrders : 0,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-green-100 text-green-800";
      case "preparing": return "bg-yellow-100 text-yellow-800";
      case "ready": return "bg-blue-100 text-blue-800";
      case "canceled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exportar reportes
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
              <div key={client.name} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <span className="font-medium">{client.name}</span>
                </div>
                <div className="text-right text-sm">
                  <div>{client.orders} pedidos</div>
                  <div className="text-muted-foreground">{PEN(client.amount)}</div>
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
              <div key={day.date} className="flex items-center justify-between p-2 border rounded">
                <div className="font-medium">
                  {new Date(day.date + "T00:00:00").toLocaleDateString("es-PE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{day.orders} pedidos</span>
                  <span className="text-muted-foreground">{PEN(day.amount)}</span>
                  <span className="text-muted-foreground">Prom: {PEN(day.average)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart3 } from "lucide-react";

import OrderFilters from "./OrderFilters";
import DayOrderCard from "./DayOrderCard";
import OrderReports from "./OrderReports";
import type { HistoryOrder, DayOrders, OrderFilter } from "./types";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function OrdersByDayView() {
  const [allOrders, setAllOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Default filter: last 7 days
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  const [filter, setFilter] = useState<OrderFilter>({
    dateFrom: weekAgo.toISOString().split('T')[0],
    dateTo: today.toISOString().split('T')[0],
    groupBy: "day",
  });

  // Load all orders
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const ordersData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.lunch_orders);
      
      if (!ordersData) {
        setAllOrders([]);
        return;
      }

      // Transform orders and create separate entries for each delivery date
      const orders: HistoryOrder[] = [];
      
      Object.entries(ordersData).forEach(([id, order]) => {
        const baseOrder = {
          id,
          code: order.code,
          clientCode: order.clientCode,
          clientName: order.clientName,
          studentName: order.studentName,
          recess: order.recess,
          status: order.status || "pending",
          total: order.total || 0,
          items: order.items || [],
          note: order.note,
          createdAt: order.createdAt,
          deliveryAt: order.deliveryAt,
          selectedDays: order.selectedDays,
          orderDate: "",
        };

        // Determinar las fechas de entrega basadas en los productos
        const deliveryDates = new Set<string>();
        
        // Si tiene días seleccionados (productos variados), agregar cada día
        if (order.selectedDays && order.selectedDays.length > 0) {
          order.selectedDays.forEach((day: string) => deliveryDates.add(day));
        }
        
        // Si tiene productos de almuerzo, agregar sus fechas específicas
        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            if (item.specificDate) {
              deliveryDates.add(item.specificDate);
            }
          });
        }
        
        // Si no hay fechas específicas, usar fecha de creación como fallback
        if (deliveryDates.size === 0) {
          const createdDate = new Date(
            typeof order.createdAt === "number" ? order.createdAt : Date.parse(order.createdAt || Date.now())
          );
          const fallbackDate = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Lima",
            year: "numeric",
            month: "2-digit", 
            day: "2-digit",
          }).format(createdDate);
          deliveryDates.add(fallbackDate);
        }

        // Crear una entrada por cada fecha de entrega
        deliveryDates.forEach((deliveryDate) => {
          orders.push({
            ...baseOrder,
            orderDate: deliveryDate,
            // Filtrar items relevantes para esta fecha
            items: (order.items || []).filter((item: any) => {
              // Si es un producto con fecha específica, debe coincidir
              if (item.specificDate) {
                return item.specificDate === deliveryDate;
              }
              // Si es un producto variado, está disponible en todos los días seleccionados
              if (order.selectedDays && order.selectedDays.includes(deliveryDate)) {
                return true;
              }
              // Si no hay fecha específica ni días seleccionados, incluir
              return !item.specificDate && (!order.selectedDays || order.selectedDays.length === 0);
            })
          });
        });
      });

      setAllOrders(orders);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and group orders by day
  const filteredDayOrders = useMemo(() => {
    let filtered = [...allOrders];

    // Date range filter
    const fromDate = new Date(filter.dateFrom);
    const toDate = new Date(filter.dateTo);
    toDate.setHours(23, 59, 59, 999);

    filtered = filtered.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= fromDate && orderDate <= toDate;
    });

    // Client name filter
    if (filter.clientName) {
      const searchTerm = filter.clientName.toLowerCase();
      filtered = filtered.filter(order =>
        (order.clientName?.toLowerCase().includes(searchTerm)) ||
        (order.studentName?.toLowerCase().includes(searchTerm))
      );
    }

    // Status filter
    if (filter.status) {
      filtered = filtered.filter(order => order.status === filter.status);
    }

    // Group by day
    const groupedByDay = filtered.reduce((acc, order) => {
      const date = order.orderDate;
      if (!acc[date]) {
        acc[date] = {
          date,
          orders: [],
          totalOrders: 0,
          totalAmount: 0,
        };
      }
      acc[date].orders.push(order);
      acc[date].totalOrders += 1;
      acc[date].totalAmount += order.total;
      return acc;
    }, {} as Record<string, DayOrders>);

    // Convert to array and sort by date (newest first)
    return Object.values(groupedByDay).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [allOrders, filter]);

  const handleApplyFilter = () => {
    // Filter is already applied via useMemo
    toast({
      title: "Filtros aplicados",
      description: `Se encontraron ${filteredDayOrders.length} días con pedidos`,
    });
  };

  const handleResetFilter = () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);

    setFilter({
      dateFrom: weekAgo.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
      groupBy: "day",
    });
  };

  const handleMarkDelivered = async (order: HistoryOrder) => {
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${order.id}/status`]: "delivered",
        [`${RTDB_PATHS.lunch_orders}/${order.id}/deliveryAt`]: new Date().toISOString(),
      });
      await loadOrders();
      toast({ title: "Pedido marcado como entregado" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el pedido",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (order: HistoryOrder) => {
    const confirmed = confirm(
      `¿Eliminar el pedido ${order.code || order.id.slice(-6)}? Esta acción no se puede deshacer.`
    );
    
    if (!confirmed) return;

    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.lunch_orders}/${order.id}`);
      if (order.clientCode) {
        await RTDBHelper.removeData(`lunch_orders_by_client/${order.clientCode}/${order.id}`);
      }
      await loadOrders();
      toast({ title: "Pedido eliminado" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el pedido",
        variant: "destructive",
      });
    }
  };

  const handlePrintDay = (dayOrders: DayOrders) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const date = new Date(dayOrders.date + "T00:00:00");
    const dateStr = date.toLocaleDateString("es-PE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <html><head><title>Pedidos del ${dateStr}</title>
      <style>
        body{font-family:Arial, sans-serif; margin:16px}
        .header{ text-align:center; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:16px;}
        .order{ border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:10px; page-break-inside: avoid;}
        .row{display:flex; justify-content:space-between; align-items:center}
        .status{font-size:12px; padding:2px 8px; border-radius:12px; background:#eee}
        .items{margin-left:12px}
        .summary{margin-top:20px; padding:10px; background:#f9f9f9; border-radius:8px;}
      </style></head><body>
      <div class="header">
        <h2>PEDIDOS DEL ${dateStr.toUpperCase()}</h2>
        <div>Total: ${dayOrders.totalOrders} pedidos - ${PEN(dayOrders.totalAmount)}</div>
        <div style="font-size:12px; color:#666;">Generado el ${new Date().toLocaleString("es-PE")}</div>
      </div>
      ${dayOrders.orders
        .map(
          (order) => `
        <div class="order">
          <div class="row">
            <div><strong>${order.clientName || order.studentName}</strong> — <em>${order.code || order.id.slice(-6)}</em></div>
            <div class="status">${order.status}</div>
          </div>
          <div><em>Productos:</em>${
            order.items?.map((i) => `<div class="items">• ${i.qty} x ${i.name}</div>`).join("") || ""
          }</div>
          ${order.studentName ? `<div><em>Alumno:</em> ${order.studentName}</div>` : ""}
          ${order.recess ? `<div><em>Recreo:</em> ${order.recess}</div>` : ""}
          ${order.note ? `<div><em>Obs:</em> ${order.note}</div>` : ""}
          <div style="text-align:right; margin-top:8px;"><strong>Total:</strong> ${PEN(order.total)}</div>
        </div>`
        )
        .join("")}
      </body></html>`;
    
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const handleExportCSV = () => {
    const allFilteredOrders = filteredDayOrders.flatMap(day => day.orders);
    
    if (!allFilteredOrders.length) {
      toast({ title: "No hay datos para exportar", variant: "destructive" });
      return;
    }

    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "fecha_pedido",
      "codigo",
      "cliente",
      "alumno",
      "recreo",
      "estado",
      "total",
      "productos",
      "observaciones",
    ];

    const rows = allFilteredOrders.map((order) => {
      const items = (order.items || [])
        .map((i) => `${i.qty}x ${i.name}`)
        .join(" | ");
      return [
        order.orderDate,
        order.code || order.id.slice(-6),
        order.clientName || "",
        order.studentName || "",
        order.recess || "",
        order.status,
        Number(order.total).toFixed(2),
        items,
        order.note || "",
      ]
        .map(esc)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_pedidos_${filter.dateFrom}_a_${filter.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    toast({
      title: "Función en desarrollo",
      description: "La exportación a PDF estará disponible próximamente",
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando historial de pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="orders" className="w-full">
        <TabsList>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Pedidos por día
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <OrderFilters
            filter={filter}
            onFilterChange={setFilter}
            onApplyFilter={handleApplyFilter}
            onResetFilter={handleResetFilter}
          />

          {filteredDayOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron pedidos en el rango de fechas seleccionado.
            </div>
          ) : (
            <div>
              {filteredDayOrders.map((dayOrders) => (
                <DayOrderCard
                  key={dayOrders.date}
                  dayOrders={dayOrders}
                  onMarkDelivered={handleMarkDelivered}
                  onDeleteOrder={handleDeleteOrder}
                  onPrintDay={handlePrintDay}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <OrderReports
            dayOrders={filteredDayOrders}
            dateRange={{ from: filter.dateFrom, to: filter.dateTo }}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
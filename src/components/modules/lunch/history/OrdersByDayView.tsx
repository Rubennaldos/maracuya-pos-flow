import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart3 } from "lucide-react";

import OrderFilters from "./OrderFilters";         // Historial (calendario/un día)
import ReportsFilters from "./ReportsFilters.tsx";
     // Reportes (rango de fechas)
import DayOrderCard from "./DayOrderCard";
import OrderReports from "./OrderReports";
import type { HistoryOrder, DayOrders, OrderFilter } from "./types";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number.isFinite(n) ? n : 0
  );

// ============ helpers ============
function norm(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Devuelve el día (YYYY-MM-DD) del pedido según tu modelo */
function getOrderDay(o: HistoryOrder): string | null {
  if (o.orderDate) return o.orderDate;                 // calculado en loadOrders
  if (o.selectedDays?.length) return o.selectedDays[0]; // varied
  if (o.deliveryAt) return o.deliveryAt;                // si lo usas
  if (o.createdAt) {
    const d = typeof o.createdAt === "number" ? new Date(o.createdAt) : new Date(o.createdAt);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  }
  return null;
}

/** Agrupa pedidos en DayOrders[] */
function groupByDay(orders: HistoryOrder[]): DayOrders[] {
  const map = new Map<string, HistoryOrder[]>();
  for (const o of orders) {
    const d = getOrderDay(o);
    if (!d) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(o);
  }
  const days = [...map.keys()].sort((a, b) => (a < b ? 1 : -1)); // desc
  return days.map((date) => {
    const list = map.get(date)!;
    const totalAmount = list.reduce((s, o) => s + (o.total || 0), 0);
    return { date, orders: list, totalOrders: list.length, totalAmount };
  });
}

// ============ componente ============
export default function OrdersByDayView() {
  const [allOrders, setAllOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- filtros del HISTORIAL (1 día) ----
  const [historyFilter, setHistoryFilter] = useState<OrderFilter>({
    day: null,
    clientName: "",
    status: undefined,
    groupBy: "day",
  });

  // ---- filtros de REPORTES (rango de fechas) ----
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  const [reportsFilter, setReportsFilter] = useState<OrderFilter>({
    dateFrom: weekAgo.toISOString().split("T")[0],
    dateTo: today.toISOString().split("T")[0],
    groupBy: "day",
  });

  // ============ cargar pedidos ============
  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const ordersData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.lunch_orders);

      if (!ordersData) {
        setAllOrders([]);
        return;
      }

      const orders: HistoryOrder[] = [];

      Object.entries(ordersData).forEach(([id, order]) => {
        const baseOrder: Omit<HistoryOrder, "orderDate"> = {
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
        };

        // Determinar fechas de entrega según items / selectedDays / fallback
        const deliveryDates = new Set<string>();
        let hasLunchItems = false;

        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            if (item.specificDate) {
              deliveryDates.add(item.specificDate);
              hasLunchItems = true;
            }
          });
        }

        if (order.selectedDays && order.selectedDays.length > 0 && !hasLunchItems) {
          order.selectedDays.forEach((d: string) => deliveryDates.add(d));
        }

        if (deliveryDates.size === 0) {
          const created = new Date(
            typeof order.createdAt === "number" ? order.createdAt : Date.parse(order.createdAt || Date.now())
          );
          const fallback = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Lima",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(created);
          deliveryDates.add(fallback);
        }

        deliveryDates.forEach((deliveryDate) => {
          const filteredItems = (order.items || []).filter((item: any) => {
            if (item.specificDate) return item.specificDate === deliveryDate;
            if (order.selectedDays && order.selectedDays.includes(deliveryDate)) return true;
            return !item.specificDate && (!order.selectedDays || order.selectedDays.length === 0);
          });

          orders.push({
            ...baseOrder,
            orderDate: deliveryDate,
            items: filteredItems,
            total:
              filteredItems.length > 0
                ? filteredItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 0)), 0)
                : order.total || 0,
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

  // ============ HISTORIAL: días disponibles + aplicar ============
  const availableDays = useMemo(() => {
    const s = new Set<string>();
    for (const o of allOrders) {
      const d = getOrderDay(o);
      if (d) s.add(d);
    }
    return Array.from(s).sort((a, b) => (a < b ? 1 : -1));
  }, [allOrders]);

  const [historyVisible, setHistoryVisible] = useState<DayOrders[]>([]);

  // Por defecto, seleccionar el día más reciente
  useEffect(() => {
    if (!historyFilter.day && availableDays.length > 0) {
      setHistoryFilter((f) => ({ ...f, day: availableDays[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDays]);

  const applyHistoryFilter = useCallback(() => {
    const targetDay = historyFilter.day ?? null;

    // 1) por día
    let subset = allOrders.filter((o) => {
      const d = getOrderDay(o);
      return targetDay ? d === targetDay : true;
    });

    // 2) por estado
    if (historyFilter.status) {
      subset = subset.filter((o) => o.status === historyFilter.status);
    }

    // 3) por nombre dentro del día
    if (historyFilter.clientName?.trim()) {
      const q = norm(historyFilter.clientName);
      subset = subset.filter((o) => {
        const a = norm(o.studentName || "");
        const c = norm(o.clientName || "");
        return a.includes(q) || c.includes(q);
      });
    }

    setHistoryVisible(groupByDay(subset));
    toast({ title: "Filtros aplicados", description: "Historial actualizado" });
  }, [allOrders, historyFilter]);

  const resetHistoryFilter = useCallback(() => {
    setHistoryFilter({ day: null, clientName: "", status: undefined, groupBy: "day" });
    setHistoryVisible([]);
  }, []);

  // ============ REPORTES: aplicar por rango ============
  const reportsVisible = useMemo(() => {
    if (!reportsFilter.dateFrom || !reportsFilter.dateTo) return [];
    let subset = [...allOrders];

    const from = new Date(reportsFilter.dateFrom);
    const to = new Date(reportsFilter.dateTo);
    to.setHours(23, 59, 59, 999);

    subset = subset.filter((o) => {
      const d = new Date(getOrderDay(o) || "");
      return !isNaN(d.getTime()) && d >= from && d <= to;
    });

    if (reportsFilter.status) {
      subset = subset.filter((o) => o.status === reportsFilter.status);
    }
    if (reportsFilter.clientName?.trim()) {
      const q = norm(reportsFilter.clientName);
      subset = subset.filter((o) => {
        const a = norm(o.studentName || "");
        const c = norm(o.clientName || "");
        return a.includes(q) || c.includes(q);
      });
    }

    return groupByDay(subset);
  }, [allOrders, reportsFilter]);

  // ============ acciones ============
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
            <div><strong>${order.clientName || order.studentName || ""}</strong> — <em>${
            order.code || order.id.slice(-6)
          }</em></div>
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
    const allFilteredOrders = reportsVisible.flatMap((d) => d.orders);
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

    const rows = allFilteredOrders.map((o) => {
      const items = (o.items || []).map((i) => `${i.qty}x ${i.name}`).join(" | ");
      return [
        o.orderDate,
        o.code || o.id.slice(-6),
        o.clientName || "",
        o.studentName || "",
        o.recess || "",
        o.status,
        Number(o.total).toFixed(2),
        items,
        o.note || "",
      ]
        .map(esc)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_pedidos_${reportsFilter.dateFrom}_a_${reportsFilter.dateTo}.csv`;
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

        {/* ---------- HISTORIAL (un día) ---------- */}
        <TabsContent value="orders" className="space-y-6">
          <OrderFilters
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
            onApplyFilter={applyHistoryFilter}
            onResetFilter={resetHistoryFilter}
            availableDays={availableDays}
          />

          {historyVisible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {historyFilter.day
                ? "No se encontraron pedidos para el día seleccionado."
                : "Selecciona un día y pulsa Aplicar filtros."}
            </div>
          ) : (
            <div>
              {historyVisible.map((dayOrders) => (
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

        {/* ---------- REPORTES (rango de fechas) ---------- */}
        <TabsContent value="reports" className="space-y-6">
          <ReportsFilters
            filter={reportsFilter}
            onFilterChange={setReportsFilter}
            onApplyFilter={() =>
              toast({ title: "Filtros aplicados", description: "Reportes actualizados" })
            }
            onResetFilter={() => {
              const t = new Date();
              const w = new Date(t);
              w.setDate(t.getDate() - 6);
              setReportsFilter({
                dateFrom: w.toISOString().split("T")[0],
                dateTo: t.toISOString().split("T")[0],
                groupBy: "day",
              });
            }}
          />

          {reportsVisible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron pedidos en el rango de fechas seleccionado.
            </div>
          ) : (
            <OrderReports
              dayOrders={reportsVisible}
              dateRange={{ from: reportsFilter.dateFrom!, to: reportsFilter.dateTo! }}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, Printer } from "lucide-react";

import OrderFilters from "./OrderFilters";         // Historial (calendario/un día)
import ReportsFilters from "./ReportsFilters";     // Reportes (rango de fechas)
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

/** YYYY-MM-DD en zona America/Lima (hoy) */
function todayLima(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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
  const days = [...map.keys()].sort(); // asc
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
        let hasSpecificDates = false;

        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            // Items con fecha específica (almuerzos normales)
            if (item.specificDate) {
              deliveryDates.add(item.specificDate);
              hasSpecificDates = true;
            }
            // Items con selectedDays (promoción semanal o varied)
            // SOLO se deben mostrar en los días configurados, NO en el día del pedido
            if (item.selectedDays && Array.isArray(item.selectedDays) && item.selectedDays.length > 0) {
              item.selectedDays.forEach((d: string) => deliveryDates.add(d));
              hasSpecificDates = true;
            }
          });
        }

        // Solo usar selectedDays del pedido si no hay items con fechas específicas
        if (order.selectedDays && order.selectedDays.length > 0 && !hasSpecificDates) {
          order.selectedDays.forEach((d: string) => deliveryDates.add(d));
          hasSpecificDates = true;
        }

        // Solo usar la fecha de creación como fallback si no hay NINGUNA fecha específica
        // (esto evita que las promociones semanales aparezcan en el día del pedido)
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
            // Si el item tiene fecha específica, solo incluirlo en ese día
            if (item.specificDate) return item.specificDate === deliveryDate;
            
            // Si el item tiene selectedDays (promoción semanal o varied), incluirlo si este día está en la lista
            if (item.selectedDays && Array.isArray(item.selectedDays)) {
              return item.selectedDays.includes(deliveryDate);
            }
            
            // Si el pedido tiene selectedDays pero el item no, incluirlo en todos los días del pedido
            if (order.selectedDays && order.selectedDays.includes(deliveryDate)) return true;
            
            // Items sin fecha específica ni selectedDays
            return !item.specificDate && (!order.selectedDays || order.selectedDays.length === 0);
          });

          // Para promociones semanales, dividir el precio entre los días
          let totalForDay = 0;
          filteredItems.forEach((item: any) => {
            const itemPrice = Number(item.price || 0);
            const itemQty = Number(item.qty || 0);
            
            // Si es promoción semanal (tiene selectedDays), dividir el precio entre los días
            if (item.selectedDays && Array.isArray(item.selectedDays) && item.selectedDays.length > 0) {
              totalForDay += (itemPrice / item.selectedDays.length) * itemQty;
            } else {
              totalForDay += itemPrice * itemQty;
            }
          });

          orders.push({
            ...baseOrder,
            orderDate: deliveryDate,
            items: filteredItems,
            total: filteredItems.length > 0 ? totalForDay : order.total || 0,
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

  // ============ HISTORIAL: días disponibles (solo HOY en adelante) ============
  const availableDays = useMemo(() => {
    const t = todayLima();
    const s = new Set<string>();
    for (const o of allOrders) {
      const d = getOrderDay(o);
      if (d && d >= t) s.add(d); // solo hoy y futuros
    }
    return Array.from(s).sort(); // asc (hoy -> futuros)
  }, [allOrders]);

  const [historyVisible, setHistoryVisible] = useState<DayOrders[]>([]);

  // Al tener availableDays, seleccionar HOY si existe; si no, el próximo día
  useEffect(() => {
    if (!availableDays.length) return;
    setHistoryFilter((f) => {
      if (f.day && availableDays.includes(f.day)) return f;
      const t = todayLima();
      const pick = availableDays.includes(t) ? t : availableDays[0];
      return { ...f, day: pick };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDays]);

  // --- APLICAR filtros (calendario + nombre + estado) ---
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

  /** Imprime un DayOrders en GRID (“cuadraditos”) */
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
        .grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:12px; }
        .card{ border:1px solid #ddd; border-radius:10px; padding:10px; page-break-inside: avoid; }
        .title{ font-weight:600; margin-bottom:6px; }
        .row{ font-size:12px; color:#444; margin:2px 0; }
        .total{ text-align:right; font-weight:600; margin-top:6px; }
      </style></head><body>
      <div class="header">
        <h2>PEDIDOS DEL ${dateStr.toUpperCase()}</h2>
        <div>Total: ${dayOrders.totalOrders} pedidos - ${PEN(dayOrders.totalAmount)}</div>
        <div style="font-size:12px; color:#666;">Generado el ${new Date().toLocaleString("es-PE")}</div>
      </div>

      <div class="grid">
      ${dayOrders.orders
        .map(
          (o) => `
        <div class="card">
          <div class="title">${o.clientName || o.studentName || ""} — <em>${o.code || o.id.slice(-6)}</em></div>
          ${o.studentName ? `<div class="row"><b>Alumno:</b> ${o.studentName}</div>` : ""}
          ${o.recess ? `<div class="row"><b>Recreo:</b> ${o.recess}</div>` : ""}
          <div class="row"><b>Estado:</b> ${o.status}</div>
          <div class="row"><b>Productos:</b> ${(o.items || [])
            .map((i) => `${i.qty} x ${i.name}`)
            .join(" | ")}</div>
          ${o.note ? `<div class="row"><b>Obs:</b> ${o.note}</div>` : ""}
          <div class="total">${PEN(o.total)}</div>
        </div>`
        )
        .join("")}
      </div>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  /** Imprime el día actualmente seleccionado (si hay datos) */
  const printSelectedDay = () => {
    if (!historyFilter.day) {
      toast({ title: "Selecciona un día para imprimir", variant: "destructive" });
      return;
    }
    // Armar DayOrders del día seleccionado
    const subset = allOrders.filter((o) => getOrderDay(o) === historyFilter.day);
    const grouped = groupByDay(subset);
    if (!grouped.length) {
      toast({ title: "No hay pedidos para imprimir en ese día", variant: "destructive" });
      return;
    }
    handlePrintDay(grouped[0]);
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
        <TabsContent value="orders" className="space-y-4">
          <OrderFilters
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
            onApplyFilter={applyHistoryFilter}
            onResetFilter={resetHistoryFilter}
            availableDays={availableDays}
          />

          {/* Botón extra: imprimir día seleccionado */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={printSelectedDay}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir día
            </Button>
          </div>

          {historyVisible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {historyFilter.day
                ? "No se encontraron pedidos para el día seleccionado."
                : "Selecciona un día y pulsa Aplicar filtros."}
            </div>
          ) : (
            <div className="space-y-4">
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

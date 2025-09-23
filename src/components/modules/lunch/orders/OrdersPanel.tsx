import { useEffect, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/components/ui/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import {
  Calendar as CalendarIcon,
  FileText,
  Download as DownloadIcon,
  CheckCircle,
  Clock,
  Trash as TrashIcon,
  Hash as HashIcon,
} from "lucide-react";

import type { OrderT } from "@/components/modules/lunch/types";

/* ========= utils ========= */
const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
}
function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
}
function fmtDateTime(ts: number | string) {
  const t = typeof ts === "number" ? ts : Date.parse(String(ts || 0));
  const dt = new Date(Number.isFinite(t) ? t : Date.now());
  return `${dt.toLocaleDateString("es-PE")} ${dt.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

type Quick = "day" | "month" | "year" | "range";

export default function OrdersPanel() {
  const [orders, setOrders] = useState<OrderT[]>([]);   // mostrados (filtrados)
  const [allOrders, setAllOrders] = useState<OrderT[]>([]); // cache completo

  // filtros
  const today = new Date();
  const [quick, setQuick] = useState<Quick>("day");
  const [dateFrom, setDateFrom] = useState<string>(toYMD(today));
  const [dateTo, setDateTo] = useState<string>(toYMD(today));

  // cargar todos
  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    try {
      const all = await RTDBHelper.getData<Record<string, OrderT>>(RTDB_PATHS.lunch_orders);
      const arr = all ? Object.values(all) : [];
      setAllOrders(arr);
      applyFilter(arr, "day", toYMD(new Date()), toYMD(new Date()));
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los pedidos.", variant: "destructive" });
    }
  }

  function applyFilter(
    source: OrderT[] = allOrders,
    mode: Quick = quick,
    fromStr: string = dateFrom,
    toStr: string = dateTo
  ) {
    let start = 0;
    let end = Number.MAX_SAFE_INTEGER;

    try {
      if (mode === "day") {
        const d = new Date(fromStr);
        start = startOfDay(d);
        end = endOfDay(d);
      } else if (mode === "month") {
        const d = new Date(fromStr);
        start = startOfMonth(d);
        end = endOfMonth(d);
      } else if (mode === "year") {
        const d = new Date(fromStr);
        start = startOfYear(d);
        end = endOfYear(d);
      } else {
        const d1 = new Date(fromStr);
        const d2 = new Date(toStr);
        start = startOfDay(d1);
        end = endOfDay(d2);
      }
    } catch {
      const d = new Date();
      start = startOfDay(d);
      end = endOfDay(d);
    }

    const filtered = source.filter((o) => {
      const t = typeof o.createdAt === "number" ? o.createdAt : Date.parse(String(o.createdAt || 0));
      return t >= start && t <= end;
    });

    filtered.sort((a, b) => {
      const ta = typeof a.createdAt === "number" ? a.createdAt : Date.parse(String(a.createdAt || 0));
      const tb = typeof b.createdAt === "number" ? b.createdAt : Date.parse(String(b.createdAt || 0));
      return tb - ta; // recientes primero
    });

    setOrders(filtered);
  }

  async function markDelivered(o: OrderT) {
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${o.id}/status`]: "delivered",
        [`${RTDB_PATHS.lunch_orders}/${o.id}/deliveryAt`]: new Date().toISOString(),
      });
      await refreshAll();
      applyFilter(); // mantiene el filtro actual
      toast({ title: "Pedido marcado como entregado" });
    } catch {
      toast({ title: "No se pudo actualizar el pedido", variant: "destructive" });
    }
  }

  async function deleteOrder(o: OrderT) {
    const ask = confirm(`¿Eliminar el pedido ${o.code ?? o.id}? Esta acción no se puede deshacer.`);
    if (!ask) return;

    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.lunch_orders}/${o.id}`);
      const cc = (o as any).clientCode;
      if (cc) await RTDBHelper.removeData(`lunch_orders_by_client/${cc}/${o.id}`);
      await refreshAll();
      applyFilter();
      toast({ title: "Pedido eliminado" });
    } catch {
      toast({ title: "No se pudo eliminar el pedido", variant: "destructive" });
    }
  }

  function printOrders() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
      <html><head><title>Pedidos</title>
      <style>
        body{font-family:Arial, sans-serif; margin:16px}
        .h{ text-align:center; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:16px;}
        .o{ border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:10px}
        .row{display:flex; justify-content:space-between; align-items:center}
        .s{font-size:12px; padding:2px 8px; border-radius:12px; background:#eee}
        .it{margin-left:12px}
      </style></head><body>
      <div class="h">
        <h2>COMANDA DE ALMUERZOS</h2>
        <div>${new Date().toLocaleString("es-PE")}</div>
      </div>
      ${orders
        .map(
          (o) => `
        <div class="o">
          <div class="row">
            <div><strong>${o.clientName}</strong> — <em>${o.code ?? ""}</em></div>
            <div class="s">${o.status}</div>
          </div>
          <div><em>Fecha:</em> ${fmtDateTime(o.createdAt)}</div>
          <div><em>Productos:</em>${
            o.items?.map((i) => `<div class="it">• ${i.qty} x ${i.name}</div>`).join("") || ""
          }</div>
          ${(o as any).studentName ? `<div><em>Alumno:</em> ${(o as any).studentName}</div>` : ""}
          ${(o as any).recess ? `<div><em>Recreo:</em> ${(o as any).recess}</div>` : ""}
          ${o.note ? `<div><em>Obs:</em> ${o.note}</div>` : ""}
          <div style="text-align:right"><strong>Total:</strong> ${PEN(o.total)}</div>
        </div>`
        )
        .join("")}
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  function exportCSV() {
    if (!orders.length) {
      toast({ title: "No hay datos para exportar", variant: "destructive" });
      return;
    }
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const headers = [
      "id",
      "codigo",
      "fecha_hora",
      "clientCode",
      "cliente",
      "alumno",
      "recreo",
      "estado",
      "total",
      "items",
      "observacion",
    ];

    const rows = orders.map((o) => {
      const items = (o.items || [])
        .map((i) => `${i.qty}x ${i.name}`)
        .join(" | ");
      return [
        o.id,
        o.code ?? "",
        fmtDateTime(o.createdAt),
        (o as any).clientCode ?? "",
        o.clientName ?? "",
        (o as any).studentName ?? "",
        (o as any).recess ?? "",
        o.status,
        Number(o.total ?? 0).toFixed(2),
        items,
        o.note ?? "",
      ]
        .map(esc)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const fileLabel =
      quick === "range"
        ? `${dateFrom}_a_${dateTo}`
        : quick === "day"
        ? dateFrom
        : quick === "month"
        ? `mes_${dateFrom.slice(0, 7)}`
        : `anio_${dateFrom.slice(0, 4)}`;

    a.href = url;
    a.download = `pedidos_${fileLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <CardTitle>Pedidos</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} title="Exportar CSV (Excel)">
            <DownloadIcon className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={printOrders}>
            <FileText className="h-4 w-4 mr-2" />
            Imprimir comanda
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="border rounded-md p-3 grid gap-3">
          <div className="grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label>Vista rápida</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={quick === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const d = toYMD(new Date());
                    setQuick("day");
                    setDateFrom(d);
                    setDateTo(d);
                    applyFilter(allOrders, "day", d, d);
                  }}
                >
                  Hoy
                </Button>
                <Button
                  variant={quick === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const d = toYMD(new Date());
                    setQuick("month");
                    setDateFrom(d);
                    applyFilter(allOrders, "month", d, d);
                  }}
                >
                  Este mes
                </Button>
                <Button
                  variant={quick === "year" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const d = toYMD(new Date());
                    setQuick("year");
                    setDateFrom(d);
                    applyFilter(allOrders, "year", d, d);
                  }}
                >
                  Este año
                </Button>
                <Button
                  variant={quick === "range" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuick("range")}
                >
                  Rango
                </Button>
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>{quick === "range" ? "Desde" : "Fecha base"}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>{quick === "range" ? "Hasta" : "—"}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={quick !== "range"}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => applyFilter(allOrders, quick, dateFrom, dateTo)}>
              Aplicar filtro
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const d = toYMD(new Date());
                setQuick("day");
                setDateFrom(d);
                setDateTo(d);
                applyFilter(allOrders, "day", d, d);
              }}
            >
              Limpiar (Hoy)
            </Button>
          </div>
        </div>

        {/* Lista de pedidos */}
        {orders.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No hay pedidos registrados en el rango seleccionado.
          </p>
        )}

        {orders.map((o) => (
          <Card key={o.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4 space-y-2">
              {/* Encabezado */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-lg">
                      {o.clientName || (o as any).studentName || "Estudiante"}
                    </div>
                    <Badge variant="secondary" title="N° de pedido">
                      <HashIcon className="h-3 w-3 mr-1" />
                      {o.code || "—"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Código: {(o as any).clientCode ?? o.code ?? "—"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      o.status === "delivered"
                        ? "default"
                        : o.status === "preparing" || o.status === "ready"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {o.status}
                  </Badge>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground" title={fmtDateTime(o.createdAt)}>
                    <Clock className="h-3 w-3" />
                    {fmtDateTime(o.createdAt)}
                  </div>
                </div>
              </div>

              {/* Productos */}
              <div className="text-sm">
                <div className="font-medium">Productos:</div>
                {o.items?.map((i, k) => (
                  <div key={k} className="ml-4 text-muted-foreground">
                    • {i.qty} x {i.name}
                  </div>
                ))}
              </div>

              {(o as any).studentName && (
                <div className="text-sm">
                  <div className="font-medium">Alumno:</div>
                  <div className="ml-4 text-muted-foreground">{(o as any).studentName}</div>
                </div>
              )}

              {(o as any).recess && (
                <div className="text-sm">
                  <div className="font-medium">Recreo:</div>
                  <div className="ml-4 text-muted-foreground">{(o as any).recess}</div>
                </div>
              )}

              {o.note && (
                <div className="text-sm">
                  <div className="font-medium">Observaciones:</div>
                  <div className="ml-4 text-muted-foreground">{o.note}</div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="font-bold">Total: {PEN(o.total)}</div>
                <div className="flex gap-2">
                  {o.status !== "delivered" && o.status !== "canceled" && (
                    <Button size="sm" onClick={() => markDelivered(o)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar entregado
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteOrder(o)} title="Eliminar pedido">
                    <TrashIcon className="h-4 w-4 mr-2" />
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

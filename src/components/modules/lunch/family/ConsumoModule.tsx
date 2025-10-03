// src/components/modules/lunch/family/ConsumoModule.tsx
import React, { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, X, Search, ShoppingBag } from "lucide-react";

type ConsumoModuleProps = {
  client: { code: string; name: string };
};

type ConsumoSale = {
  id: string;
  correlative: string;
  client: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  paymentMethod: string;
  type: string;
  status: string;
  date: string;
  time: string;
  ts: number;
};

export default function ConsumoModule({ client }: ConsumoModuleProps) {
  const [sales, setSales] = useState<ConsumoSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromStr, setFromStr] = useState<string>("");
  const [toStr, setToStr] = useState<string>("");

  useEffect(() => {
    loadClientSales();
  }, [client.code]);

  const loadClientSales = async () => {
    setLoading(true);
    try {
      const salesData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      if (!salesData) {
        setSales([]);
        return;
      }

      const clientSales: ConsumoSale[] = Object.entries(salesData)
        .filter(([_, raw]) => {
          const clientId = raw?.client?.id || raw?.client?.code || "";
          const clientName = raw?.client?.fullName || raw?.client?.name || "";
          return clientId === client.code || clientName.includes(client.code);
        })
        .map(([id, raw]) => {
          const rawDate = raw?.createdAt || raw?.date;
          const d = rawDate ? new Date(rawDate) : new Date(0);
          const ts = d.getTime();

          return {
            id,
            correlative: String(raw?.correlative ?? id),
            client: raw?.client?.fullName || raw?.client?.name || client.name,
            total: Number(raw?.total ?? 0),
            items: Array.isArray(raw?.items) ? raw.items : [],
            paymentMethod: String(raw?.paymentMethod ?? "").toLowerCase(),
            type: String(raw?.type ?? "normal"),
            status: String(raw?.status ?? "completed"),
            date: rawDate ? d.toLocaleDateString("es-PE") : "",
            time: rawDate ? d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
            ts,
          };
        })
        .sort((a, b) => b.ts - a.ts);

      setSales(clientSales);
    } catch (error) {
      console.error("Error loading client sales:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtros de fecha
  const toStartMs = (yyyyMmDd: string) => {
    const d = new Date(yyyyMmDd);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const toEndMs = (yyyyMmDd: string) => {
    const d = new Date(yyyyMmDd);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  const applyToday = () => {
    const n = new Date();
    const v = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    setFromStr(v);
    setToStr(v);
  };

  const applyThisWeek = () => {
    const n = new Date();
    const day = (n.getDay() + 6) % 7;
    const from = new Date(n);
    from.setDate(n.getDate() - day);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setFromStr(f(from));
    setToStr(f(to));
  };

  const applyThisMonth = () => {
    const n = new Date();
    const from = new Date(n.getFullYear(), n.getMonth(), 1);
    const to = new Date(n.getFullYear(), n.getMonth() + 1, 0);
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setFromStr(f(from));
    setToStr(f(to));
  };

  const clearDates = () => {
    setFromStr("");
    setToStr("");
  };

  const filteredSales = useMemo(() => {
    const byText = (s: ConsumoSale) =>
      s.correlative?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.items.some((item) => item.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    const hasFrom = !!fromStr;
    const hasTo = !!toStr;
    const fromMs = hasFrom ? toStartMs(fromStr) : -Infinity;
    const toMs = hasTo ? toEndMs(toStr) : Infinity;

    return sales.filter((s) => byText(s) && s.ts >= fromMs && s.ts <= toMs);
  }, [sales, searchTerm, fromStr, toStr]);

  const totalConsumo = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  }, [filteredSales]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Cargando datos de consumo...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Detalle de Consumo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Historial de compras de {client.name} ({client.code})
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por comprobante o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros de fecha */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <CalendarRange className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="flex-1"
                aria-label="Desde"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="flex-1"
                aria-label="Hasta"
              />
              {(fromStr || toStr) && (
                <Button variant="ghost" size="sm" onClick={clearDates} title="Limpiar">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={applyToday}>
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={applyThisWeek}>
                Semana
              </Button>
              <Button variant="outline" size="sm" onClick={applyThisMonth}>
                Mes
              </Button>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total consumo:</span>
              <span className="text-2xl font-bold text-primary">
                S/ {totalConsumo.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {filteredSales.length} {filteredSales.length === 1 ? "compra" : "compras"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de ventas */}
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No se encontraron compras con los filtros seleccionados
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSales.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{sale.correlative}</span>
                      <Badge variant="outline" className="text-xs">
                        {sale.type === "lunch" ? "Almuerzo" : sale.type === "normal" ? "Normal" : sale.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sale.date} · {sale.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">S/ {sale.total.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {sale.paymentMethod || "Efectivo"}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1 border-t pt-2">
                  {sale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">
                        S/ {(item.quantity * item.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

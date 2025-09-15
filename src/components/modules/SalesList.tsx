import { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SalesEditor } from "./SalesEditor";
import { PrintManager } from "@/lib/print";
import {
  ArrowLeft,
  Search,
  Edit,
  Trash2,
  Eye,
  Calendar as CalendarIcon,
  User,
  DollarSign,
  AlertTriangle,
  Clock,
  Printer,
  X,
  CalendarRange,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* =========================================
   Types
========================================= */
interface SalesListProps {
  onBack: () => void;
}

type UISale = {
  id: string;
  correlative: string;
  client: string; // para UI
  user: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  paymentMethod: string;
  type: string;
  status: string;
  date: string; // formateado
  time: string; // formateado
  ts: number; // timestamp en ms
  createdAt?: string;
};

// Ítem que espera el editor
type EditorItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isKitchen: boolean;
};

// Venta que espera el editor (client como objeto + items completos)
type EditorSale = Omit<UISale, "client" | "items"> & {
  client: { id: string; name: string };
  items: EditorItem[];
};

/* Adaptador de venta para el editor */
const toEditorSale = (s: UISale | null): EditorSale | null => {
  if (!s) return null;
  return {
    ...s,
    client: {
      id: s.client === "Cliente Varios" ? "varios" : s.client,
      name: s.client || "Cliente Varios",
    },
    items: (s.items ?? []).map((it, idx) => ({
      id: (it as any).id ?? `${s.id}-${idx}`,
      name: it.name ?? "",
      quantity: Number(it.quantity ?? 0),
      price: Number(it.price ?? 0),
      isKitchen: Boolean((it as any).isKitchen ?? false),
    })),
  };
};

/* =========================================
   Componente
========================================= */
export const SalesList = ({ onBack }: SalesListProps) => {
  const [sales, setSales] = useState<UISale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Filtros por rango de fechas
  const [fromStr, setFromStr] = useState<string>(""); // YYYY-MM-DD
  const [toStr, setToStr] = useState<string>(""); // YYYY-MM-DD

  const [selectedSale, setSelectedSale] = useState<UISale | null>(null);
  const [editingSale, setEditingSale] = useState<UISale | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  // Normaliza la carga desde RTDB
  const loadSales = async () => {
    try {
      const salesData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      if (!salesData) {
        setSales([]);
        return;
      }

      const salesArray: UISale[] = Object.entries(salesData)
        .map(([id, raw]) => {
          const rawDate = raw?.createdAt || raw?.date;
          const d = rawDate ? new Date(rawDate) : new Date(0);
          const ts = d.getTime();

          const items = Array.isArray(raw?.items) ? raw.items : [];
          const total = Number(raw?.total ?? 0);

          return {
            id,
            correlative: String(raw?.correlative ?? id),
            client:
              raw?.client?.fullName ||
              raw?.client?.name ||
              (typeof raw?.client === "string" ? raw.client : "") ||
              "Cliente Varios",
            user: raw?.createdBy || raw?.cashier || "Sistema",
            total,
            items,
            paymentMethod: String(raw?.paymentMethod ?? "").toLowerCase(),
            type: String(raw?.type ?? "normal"),
            status: String(raw?.status ?? "completed"),
            date: rawDate ? d.toLocaleDateString() : "",
            time: rawDate ? d.toLocaleTimeString() : "",
            ts,
            createdAt: raw?.createdAt ?? undefined,
          } as UISale;
        })
        .sort((a, b) => b.ts - a.ts);

      setSales(salesArray);
    } catch (error) {
      console.error("Error loading sales:", error);
    }
  };

  const deleteSale = async (saleId: string) => {
    try {
      // Get sale data before moving to deleted_sales
      const saleData = await RTDBHelper.getData(`${RTDB_PATHS.sales}/${saleId}`);
      if (!saleData) {
        console.error("Sale not found");
        return;
      }

      // Move to deleted_sales with metadata
      const deletedSaleData = {
        ...saleData,
        type: "normal",
        deletedAt: new Date().toISOString(),
        deletedBy: "sistema", // You could get current user here
      };

      await RTDBHelper.setData(`${RTDB_PATHS.deleted_sales}/${saleId}`, deletedSaleData);
      
      // Remove from original location
      await RTDBHelper.removeData(`${RTDB_PATHS.sales}/${saleId}`);
      
      setSales((prev) => prev.filter((s) => s.id !== saleId));
    } catch (error) {
      console.error("Error moving sale to deleted:", error);
    }
  };

  const handleSaveEdit = async (editedSale: any) => {
    try {
      const updates = { [`${RTDB_PATHS.sales}/${editedSale.id}`]: editedSale };
      await RTDBHelper.updateData(updates);
      setSales((prev) => prev.map((s) => (s.id === editedSale.id ? { ...s, ...editedSale } : s)));
    } catch (error) {
      console.error("Error updating sale:", error);
    }
  };

  const handleReprintTicket = async (sale: UISale) => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const printableOrder = {
        id: sale.id,
        correlative: sale.correlative,
        date: sale.date || "",
        time: sale.time || "",
        client: sale.client || "Cliente Varios",
        items: Array.isArray(sale.items) ? sale.items : [],
        subtotal: Number(sale.total ?? 0),
        total: Number(sale.total ?? 0),
        paymentMethod: sale.paymentMethod || "",
        type: "customer" as const,
        user: sale.user || "Sistema",
      };
      await PrintManager.printCustomerTicket(printableOrder);
    } catch (error) {
      console.error("Error reprinting ticket:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success text-success-foreground">Completada</Badge>;
      case "pending":
        return <Badge className="bg-warning text-warning-foreground">Pendiente</Badge>;
      case "delivered":
        return <Badge className="bg-primary text-primary-foreground">Entregada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "normal":
        return <Badge variant="outline">Normal</Badge>;
      case "lunch":
        return <Badge className="bg-accent text-accent-foreground">Almuerzo</Badge>;
      case "scheduled":
        return <Badge className="bg-secondary text-secondary-foreground">Programada</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Helpers de fecha
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

  // Presets
  const applyToday = () => {
    const n = new Date();
    const yyyy = n.getFullYear();
    const mm = String(n.getMonth() + 1).padStart(2, "0");
    const dd = String(n.getDate()).padStart(2, "0");
    const v = `${yyyy}-${mm}-${dd}`;
    setFromStr(v);
    setToStr(v);
  };
  const applyYesterday = () => {
    const n = new Date();
    n.setDate(n.getDate() - 1);
    const yyyy = n.getFullYear();
    const mm = String(n.getMonth() + 1).padStart(2, "0");
    const dd = String(n.getDate()).padStart(2, "0");
    const v = `${yyyy}-${mm}-${dd}`;
    setFromStr(v);
    setToStr(v);
  };
  const applyThisWeek = () => {
    const n = new Date();
    const day = (n.getDay() + 6) % 7; // Lunes = 0
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
  const applyLastNDays = (num: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (num - 1));
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setFromStr(f(start));
    setToStr(f(end));
  };
  const clearDates = () => {
    setFromStr("");
    setToStr("");
  };

  // Filtro combinado texto + fechas
  const filteredSales = useMemo(() => {
    const byText = (s: UISale) =>
      s.correlative?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.paymentMethod?.toLowerCase().includes(searchTerm.toLowerCase());

    const hasFrom = !!fromStr;
    const hasTo = !!toStr;
    const fromMs = hasFrom ? toStartMs(fromStr) : -Infinity;
    const toMs = hasTo ? toEndMs(toStr) : Infinity;

    return sales.filter((s) => byText(s) && s.ts >= fromMs && s.ts <= toMs);
  }, [sales, searchTerm, fromStr, toStr]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Lista de Ventas</h1>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Toolbar: búsqueda + rango fechas */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por comprobante, cliente o método de pago..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="w-[160px]"
                aria-label="Desde"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="w-[160px]"
                aria-label="Hasta"
              />
              {(fromStr || toStr) && (
                <Button variant="ghost" size="sm" onClick={clearDates} title="Limpiar rango">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* presets */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={applyToday}>
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={applyYesterday}>
                Ayer
              </Button>
              <Button variant="outline" size="sm" onClick={applyThisWeek}>
                Semana
              </Button>
              <Button variant="outline" size="sm" onClick={applyThisMonth}>
                Mes
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyLastNDays(7)}>
                Últ. 7
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyLastNDays(30)}>
                Últ. 30
              </Button>
            </div>
          </div>
        </div>

        {/* Sales List */}
        <div className="space-y-4">
          {filteredSales.map((sale) => (
            <Card key={sale.id} className="hover:shadow-medium transition-shadow overflow-visible">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold text-lg">{sale.correlative}</h3>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {sale.date} - {sale.time}
                      </p>
                    </div>
                    {getTypeBadge(sale.type)}
                    {getStatusBadge(sale.status)}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingSale(sale)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReprintTicket(sale)} disabled={isPrinting}>
                      <Printer className="w-4 h-4 mr-1" />
                      {isPrinting ? "Imprimiendo..." : "Reimprimir"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                            ¿Eliminar venta?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La venta {sale.correlative} será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSale(sale.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Cliente:</strong> {sale.client}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Total:</strong> S/ {sale.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Vendedor:</strong> {sale.user}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-sm">
                  <strong>Productos:</strong>
                  <ul className="mt-2 space-y-1">
                    {sale.items?.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span>S/ {(item.quantity * item.price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron ventas</h3>
            <p className="text-muted-foreground">Ajusta el texto o el rango de fechas</p>
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalle de Venta</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSale(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Comprobante:</strong>
                  <p>{selectedSale.correlative}</p>
                </div>
                <div>
                  <strong>Fecha:</strong>
                  <p>{selectedSale.date}</p>
                </div>
                <div>
                  <strong>Hora:</strong>
                  <p>{selectedSale.time}</p>
                </div>
                <div>
                  <strong>Cliente:</strong>
                  <p>{selectedSale.client}</p>
                </div>
                <div>
                  <strong>Método de Pago:</strong>
                  <p className="capitalize">{selectedSale.paymentMethod}</p>
                </div>
                <div>
                  <strong>Vendedor:</strong>
                  <p>{selectedSale.user}</p>
                </div>
              </div>

              <Separator />

              <div>
                <strong className="text-sm">Productos:</strong>
                <div className="mt-2 space-y-2">
                  {selectedSale.items?.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>S/ {(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>S/ {selectedSale.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Editor */}
      <SalesEditor
        sale={toEditorSale(editingSale)}
        isOpen={!!editingSale}
        onClose={() => setEditingSale(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
};

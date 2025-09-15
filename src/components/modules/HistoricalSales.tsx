import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Search, Plus, Minus, Calendar as CalendarIcon,
  ShoppingCart, Clock, User, DollarSign
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/* ---------- Tipos ---------- */
type Product = {
  id: string;
  name: string;
  category?: string;
  image?: string;
  price?: number;
  salePrice?: number;
};

type CartItem = { id: string; name: string; price: number; quantity: number; notes?: string };
type ClientRow = { id: string; name: string };

/* ---------- Cargas ---------- */
const loadProducts = async (): Promise<Product[]> => {
  try {
    const productsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.products);
    if (!productsData) return [];
    return Object.entries(productsData).map(([id, p]: [string, any]) => ({
      id,
      name: p?.name ?? "Producto",
      category: p?.category ?? "",
      image: p?.image ?? "",
      price: Number(p?.price ?? 0),
      salePrice: Number(p?.salePrice ?? p?.price ?? 0),
    }));
  } catch (e) {
    console.error("Error loading products:", e);
    return [];
  }
};

const loadClients = async (): Promise<ClientRow[]> => {
  try {
    const clientsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
    if (!clientsData) return [];
    const list = Object.entries(clientsData).map(([id, c]: [string, any]) => {
      const name =
        c?.fullName ||
        [c?.names, c?.lastNames].filter(Boolean).join(" ") ||
        c?.name ||
        c?.code ||
        "Cliente";
      return { id, name: String(name).trim() || "Cliente" };
    });
    return list
      .filter((x) => x.id !== "varios")
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  } catch (e) {
    console.error("Error loading clients:", e);
    return [];
  }
};

/* ---------- Modal simple ---------- */
function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[min(720px,95vw)] rounded-xl bg-background border border-border shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} type="button">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Componente ---------- */
interface HistoricalSalesProps { onBack: () => void; }

export const HistoricalSales = ({ onBack }: HistoricalSalesProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Clientes
  const [clientQuery, setClientQuery] = useState("");
  const [allClients, setAllClients] = useState<ClientRow[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  // Confirmación y bloqueo anti-doble guardado
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Carga inicial
  useEffect(() => {
    loadProducts().then(setProducts);
    loadClients().then((list) => {
      setAllClients(list);
      setFilteredClients(list);
    });
  }, []);

  // Filtrado de clientes
  useEffect(() => {
    const q = clientQuery.trim().toLowerCase();
    setFilteredClients(!q ? allClients : allClients.filter((c) => c.name.toLowerCase().includes(q)));
  }, [clientQuery, allClients]);

  // Auto-seleccionar el primer cliente cuando se abre el modal (para Enter directo)
  useEffect(() => {
    if (clientModalOpen && filteredClients.length > 0 && !selectedClient) {
      setSelectedClient(filteredClients[0]);
    }
    if (clientModalOpen && filteredClients.length > 0 && selectedClient) {
      const stillThere = filteredClients.some(c => c.id === selectedClient.id);
      if (!stillThere) setSelectedClient(filteredClients[0]);
    }
  }, [clientModalOpen, filteredClients, selectedClient]);

  /* -------- ENTER: abrir modal y luego confirmación (sin guardar directo) -------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (cart.length === 0) return;
      e.preventDefault();
      e.stopPropagation();

      if (!clientModalOpen) {
        setClientModalOpen(true);
        return;
      }
      // Si el modal está abierto, pasamos a confirmar (no guardamos aún)
      if (clientModalOpen && selectedClient) {
        setConfirmOpen(true);
        setTimeout(() => confirmBtnRef.current?.focus(), 0);
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey as any, { capture: true } as any);
  }, [cart.length, clientModalOpen, selectedClient]);

  /* -------- Productos -------- */
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (p: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      return ex
        ? prev.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === productId);
      if (ex && ex.quantity > 1) {
        return prev.map((i) =>
          i.id === productId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== productId);
    });
  };

  const getTotalAmount = () =>
    cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const clearCart = () => setCart([]);

  /* -------- Guardar venta histórica (siempre crédito) -------- */
  const processHistoricalSale = async () => {
    if (isSaving) return; // evita doble guardado
    if (cart.length === 0) {
      alert("Agregue productos al carrito");
      return;
    }
    if (!selectedDate) {
      alert("Seleccione una fecha");
      return;
    }
    if (!selectedClient) {
      setClientModalOpen(true);
      alert("Debe seleccionar un cliente registrado para ventas históricas (crédito).");
      return;
    }

    setIsSaving(true);
    try {
      const correlative = await RTDBHelper.getNextCorrelative("historical");
      const nowIso = new Date().toISOString();
      const saleDateStr = format(selectedDate, "yyyy-MM-dd");

      const saleData = {
        correlative,
        date: saleDateStr,          // RESPETA la fecha elegida
        items: cart,
        total: getTotalAmount(),
        paymentMethod: "credito",
        type: "historical",
        status: "completed",
        createdAt: nowIso,
        client: { id: selectedClient.id, fullName: selectedClient.name },
        user: "Sistema",
      };

      // 1) Guardar la venta
      const saleId = await RTDBHelper.pushData(RTDB_PATHS.sales, saleData);

      // 2) Registrar SOLO UNA entrada en Cuentas por Cobrar:
      //    accounts_receivable/{clientId}/entries/{saleId}
      const arEntryPath = `${RTDB_PATHS.accounts_receivable}/${selectedClient.id}/entries/${saleId}`;
      await RTDBHelper.setData(arEntryPath, {
        status: "pending",
        amount: saleData.total,
        date: saleData.date,
        type: "VH", // Venta Histórica
        items: saleData.items,
        correlative: saleData.correlative,
        clientName: selectedClient.name,
        saleId,
        createdAt: nowIso,
      });

      // ❗️IMPORTANTE: Se eliminó el "espejo plano" que causaba duplicado:
      //    NO escribir en `${accounts_receivable}/${saleId}`

      setClientModalOpen(false);
      setConfirmOpen(false);
      alert(`Venta histórica registrada (crédito) — Comprobante: ${correlative}`);

      clearCart();
      setSelectedClient(null);
    } catch (error) {
      console.error("Error processing historical sale:", error);
      alert("Error al procesar la venta histórica");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Button variant="outline" onClick={onBack} className="mb-6 flex items-center gap-2" type="button">
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Ventas Históricas (Crédito)
          </h2>

          <div className="flex items-center gap-3">
            {/* Fecha (se respeta al guardar) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  type="button"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={() => setClientModalOpen(true)} className="flex items-center gap-2" type="button">
              <User className="h-4 w-4" />
              {selectedClient ? `Cliente: ${selectedClient.name}` : "Seleccionar cliente"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Productos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    addToCart({
                      id: product.id,
                      name: product.name,
                      price: Number(product.salePrice ?? product.price ?? 0),
                    })
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.category}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            <DollarSign className="h-3 w-3 mr-1" />
                            S/ {(product.salePrice ?? product.price ?? 0).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                      {product.image && (
                        <img src={product.image} alt={product.name} className="w-12 h-12 rounded object-cover ml-4" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No se encontraron productos</p>
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito de Venta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          S/ {item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => removeFromCart(item.id)} type="button">
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                          type="button"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Carrito vacío</p>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    <div className="flex justify-between items-center font-medium">
                      <span>Total:</span>
                      <span>S/ {getTotalAmount().toFixed(2)}</span>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={() => setClientModalOpen(true)}
                        className="w-full"
                        disabled={cart.length === 0 || !selectedDate}
                        type="button"
                      >
                        Seleccionar cliente y registrar (Enter)
                      </Button>
                      <Button variant="outline" onClick={clearCart} className="w-full" type="button">
                        Limpiar Carrito
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Tip: presiona <b>Enter</b> para abrir selección de cliente y <b>Enter</b> otra vez para confirmar.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de clientes */}
      <Modal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title="Seleccionar Cliente (Crédito)"
      >
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Buscar cliente…"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            className="h-14 text-lg"
          />
          <div className="max-h-80 overflow-y-auto border rounded-md">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                className={`w-full text-left px-3 py-2 hover:bg-muted ${selectedClient?.id === c.id ? "bg-muted" : ""}`}
                onClick={() => setSelectedClient(c)}
                title={c.name}
                type="button"
              >
                {c.name}
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No se encontraron clientes…</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClientModalOpen(false)} type="button">
              Cancelar
            </Button>
            <Button onClick={() => { setConfirmOpen(true); }} disabled={!selectedClient} type="button">
              Continuar (Enter)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            * Solo se permiten ventas a <b>crédito</b> y con cliente <b>registrado</b>. Se usará la fecha mostrada arriba.
          </p>
        </div>
      </Modal>

      {/* Confirmación */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar venta histórica"
      >
        <div className="space-y-3">
          <p><b>Cliente:</b> {selectedClient?.name ?? "—"}</p>
          <p><b>Fecha:</b> {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "—"}</p>
          <p><b>Items:</b> {cart.reduce((s, i) => s + i.quantity, 0)} — <b>Total:</b> S/ {getTotalAmount().toFixed(2)}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} type="button">
              Volver
            </Button>
            <Button
              ref={confirmBtnRef as any}
              onClick={processHistoricalSale}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? "Guardando..." : "Confirmar (Enter)"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

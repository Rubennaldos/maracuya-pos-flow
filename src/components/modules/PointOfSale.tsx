import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  ArrowLeft,
  Utensils,
  Clock,
  GraduationCap,
  Save,
  Trash2,
  AlertTriangle,
  User,
} from "lucide-react";
import { bindHotkeys } from "@/lib/hotkeys";
import { useSaleFlow } from "@/hooks/useSaleFlow";
import { Client } from "@/types/client";

/* ---------------- Modal simple ---------------- */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[min(720px,95vw)] rounded-xl bg-background border border-border shadow-xl p-4 animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} type="button">
            <X className="w-4 h-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------- Load products from RTDB --------------- */
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

const loadProducts = async () => {
  try {
    const productsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.products);
    if (productsData) {
      return Object.entries(productsData).map(([id, product]: [string, any]) => ({
        id,
        ...product,
        price: Number(product.salePrice ?? product.price ?? 0),
        image: product.image || "/placeholder.svg",
        isKitchen: Boolean(product.isKitchen),
      }));
    }
    return [];
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isKitchen: boolean;
  notes?: string;
};
type Step = "productos" | "cliente" | "pago" | "confirm";

interface PointOfSaleProps {
  onBack: () => void;
}

export const PointOfSale = ({ onBack }: PointOfSaleProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [saleType, setSaleType] = useState<"normal" | "scheduled" | "lunch">("normal");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Flujo visual (modales)
  const [step, setStep] = useState<Step>("productos");
  const [clientQuery, setClientQuery] = useState("");

  type ClientRow = { id: string; name: string };
  const [clientResults, setClientResults] = useState<ClientRow[]>([
    { id: "varios", name: "Cliente Varios" },
  ]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [payMethod, setPayMethod] = useState<
    "efectivo" | "transferencia" | "credito" | "yape" | "plin" | null
  >(null);

  // Estado para autorización parental
  const [showParentalAuth, setShowParentalAuth] = useState(false);
  const [currentClientForAuth, setCurrentClientForAuth] = useState<Client | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);

  // Hook que guarda en RTDB e imprime cocina si aplica
  const { flowManager, isProcessing, saveDraft, processSale } = useSaleFlow({
    onComplete: () => {
      setCart([]);
      setSelectedClient(null);
      setPayMethod(null);
      setStep("productos");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    },
  });

  // Load products on mount
  useEffect(() => {
    loadProducts().then(setProducts);
  }, []);

  /* ---------------- Carrito ---------------- */
  const addToCart = (p: any) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      return ex
        ? prev.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { id: p.id, name: p.name, price: Number(p.price ?? 0), quantity: 1, isKitchen: !!p.isKitchen }];
    });
  };
  const updateQuantity = (id: string, qty: number) =>
    setCart((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))));
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  const filteredProducts = products.filter(
    (product: any) =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ---------------- Clientes ---------------- */
  const loadClients = async (): Promise<ClientRow[]> => {
    try {
      const clientsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
      if (!clientsData) return [{ id: "varios", name: "Cliente Varios" }];

      const list = Object.entries(clientsData).map(([id, c]: [string, any]) => {
        const name =
          (typeof c === "string" && c) ||
          c?.fullName ||
          [c?.names, c?.lastNames].filter(Boolean).join(" ") ||
          c?.name ||
          c?.code ||
          "Cliente";
        return { id, name: String(name).trim() || "Cliente" };
      });

      const withVarios = [{ id: "varios", name: "Cliente Varios" }, ...list]
        .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

      return withVarios;
    } catch (error) {
      console.error("Error loading clients:", error);
      return [{ id: "varios", name: "Cliente Varios" }];
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const all = await loadClients();
      const q = clientQuery.trim().toLowerCase();
      const filtered = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
      if (alive) setClientResults(filtered);
    })();
    return () => {
      alive = false;
    };
  }, [clientQuery]);

  /* ---------------- Autorización de crédito ---------------- */
  const loadFullClientData = async (clientId: string): Promise<Client | null> => {
    try {
      const clientData = await RTDBHelper.getData<Client>(`${RTDB_PATHS.clients}/${clientId}`);
      return clientData || null;
    } catch (error) {
      console.error("Error loading client data:", error);
      return null;
    }
  };

  const checkParentalAuth = async (): Promise<boolean> => {
    if (!selectedClient || selectedClient.id === "varios") {
      setCurrentClientForAuth(null);
      setShowParentalAuth(true);
      return true; // requiere autorización
    }
    const full = await loadFullClientData(selectedClient.id);
    if (!full) {
      setCurrentClientForAuth(null);
      setShowParentalAuth(true);
      return true;
    }

    // ✅ regla: crédito activo solo si accountEnabled && active
    const hasActiveCredit =
      (full.accountEnabled === true || (full.creditLimit ?? 0) > 0) &&
      (full.active === true);

    if (!hasActiveCredit) {
      setCurrentClientForAuth(full);
      setShowParentalAuth(true);
      return true;
    }
    return false;
  };

  const handleParentalAuth = (authorized: boolean) => {
    setShowParentalAuth(false);
    if (authorized) {
      setStep("confirm");
    } else {
      setPayMethod(null);
      setStep("productos");
      setSelectedClient(null);
      alert("Consulta al padre o apoderado y vuelve a realizar la venta.");
    }
    setCurrentClientForAuth(null);
  };

  /* ---------------- Flujo con Enter ---------------- */
  const goNext = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (step === "productos") {
      setSelectedClient(null);
      setClientQuery("");
      setStep("cliente");
      return;
    }
    if (step === "cliente") {
      if (!selectedClient) setSelectedClient({ id: "varios", name: "Cliente Varios" });
      setStep("pago");
      return;
    }
    if (step === "pago") {
      if (!payMethod) return;
      if (payMethod === "credito") {
        setCheckingAuth(true);
        try {
          const needsAuth = await checkParentalAuth();
          if (needsAuth) return; // el modal manejará el flujo
        } finally {
          setCheckingAuth(false);
        }
      }
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      flowManager.updateCart(cart);
      await processSale({
        cart,
        total,
        saleType,
        paymentMethod: payMethod,
        selectedClient: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, fullName: selectedClient.name }
          : { id: "varios", name: "Cliente Varios", fullName: "Cliente Varios" },
        origin: "PV",
      });
      setCart([]);
      setPayMethod(null);
      setSelectedClient(null);
      setStep("productos");
      return;
    }
  };

  /* ---------------- Hotkeys ---------------- */
  const goNextRef = useRef(goNext);
  const clearCartRef = useRef(clearCart);
  const saveDraftRef = useRef(saveDraft);
  const setSaleTypeRef = useRef(setSaleType);

  useEffect(() => { goNextRef.current = goNext; });
  useEffect(() => { clearCartRef.current = clearCart; });
  useEffect(() => { saveDraftRef.current = saveDraft; });
  useEffect(() => { setSaleTypeRef.current = setSaleType; });

  useEffect(() => {
    const unbind = bindHotkeys({
      onEnter: () => goNextRef.current(),
      onCtrlEnter: () => goNextRef.current(),
      onEsc: () => clearCartRef.current(),
      onF2: () => { if (cart.length > 0) { flowManager.updateCart(cart); saveDraftRef.current(); } },
      onCtrlS: () => { if (cart.length > 0) { flowManager.updateCart(cart); saveDraftRef.current(); } },
      onF3: () => setSaleTypeRef.current("scheduled"),
      onCtrlP: () => setSaleTypeRef.current("scheduled"),
      onF4: () => setSaleTypeRef.current("lunch"),
      onCtrlL: () => setSaleTypeRef.current("lunch"),
    });
    return unbind;
  }, [cart.length]);

  useEffect(() => { flowManager.updateCart(cart); }, [cart, flowManager]);

  const hasKitchen = cart.some((i) => i.isKitchen);

  const nowStr = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack} type="button">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Punto de Venta</h1>
          </div>

          <div className="flex items-center space-x-2">
            {/* Cliente seleccionado a la vista */}
            <div className="hidden md:flex items-center px-3 py-1 rounded border text-sm text-muted-foreground">
              <User className="w-4 h-4 mr-1" />
              {selectedClient ? `Cliente: ${selectedClient.name}` : "Cliente: —"}
            </div>

            <Button variant={saleType === "normal" ? "default" : "outline"} onClick={() => setSaleType("normal")} size="sm" type="button">Normal</Button>
            <Button variant={saleType === "scheduled" ? "default" : "outline"} onClick={() => setSaleType("scheduled")} size="sm" type="button">
              <Clock className="w-4 h-4 mr-1" /> Programada (F3)
            </Button>
            <Button variant={saleType === "lunch" ? "default" : "outline"} onClick={() => setSaleType("lunch")} size="sm" type="button">
              <GraduationCap className="w-4 h-4 mr-1" /> Almuerzos (F4)
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Productos */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar productos... (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-lg h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((p: any) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-medium transition-all duration-200 group border-2 hover:border-primary"
                onClick={() => addToCart(p)}
              >
                <CardContent className="p-0">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-full h-40 object-cover rounded-t-lg" />
                    {p.isKitchen && (
                      <Badge className="absolute top-2 right-2 bg-pos-kitchen text-foreground">
                        <Utensils className="w-3 h-3 mr-1" /> Cocina
                      </Badge>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">{p.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">S/ {(p.price || 0).toFixed(2)}</span>
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Carrito */}
        <div className="w-96 bg-pos-checkout border-l border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-pos-checkout-foreground flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" /> Carrito ({cart.length})
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => clearCart()} type="button">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Carrito vacío</p>
                <p className="text-sm text-muted-foreground">Seleccione productos para agregar</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.id} className="border border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{item.name}</h4>
                        {item.isKitchen && (
                          <Badge variant="secondary" className="mt-1">
                            <Utensils className="w-3 h-3 mr-1" /> Cocina
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity - 1)} type="button">
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity + 1)} type="button">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="font-bold text-primary">S/ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-4 border-t border-border bg-card">
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-bold">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-primary">S/ {total.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    className="w-full h-12 text-lg bg-gradient-to-r from-primary to-primary-light"
                    onClick={() => goNext()}
                    disabled={isProcessing || cart.length === 0}
                    type="button"
                  >
                    {isProcessing ? "Procesando..." : "Procesar Venta (Enter)"}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (cart.length > 0) {
                          flowManager.updateCart(cart);
                          saveDraft();
                        }
                      }}
                      disabled={cart.length === 0}
                      type="button"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Borrador (F2)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => clearCart()} type="button">
                      <X className="w-4 h-4 mr-1" />
                      Cancelar (Esc)
                    </Button>
                  </div>

                  {hasKitchen && (
                    <p className="text-xs text-muted-foreground">
                      * Contiene productos de <b>cocina</b>. La comanda se imprimirá automáticamente al confirmar.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --------- MODALES --------- */}
      <Modal open={step === "cliente"} onClose={() => setStep("productos")} title="Seleccionar Cliente">
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Buscar cliente…"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            className="h-14 text-lg md:text-lg"
          />
          <div className="max-h-80 overflow-y-auto border rounded-md">
            {clientResults.map((c) => (
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
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setSelectedClient({ id: "varios", name: "Cliente Varios" })} type="button">
              Cliente Varios
            </Button>
            <Button onClick={() => goNext()} type="button">Continuar (Enter)</Button>
          </div>
        </div>
      </Modal>

      <Modal open={step === "pago"} onClose={() => setStep("cliente")} title="Método de Pago">
        <div className="grid grid-cols-2 gap-2">
          {(["efectivo", "transferencia", "credito", "yape", "plin"] as const).map((m) => (
            <Button key={m} variant={payMethod === m ? "default" : "outline"} onClick={() => setPayMethod(m)} type="button">
              {m.toUpperCase()}
            </Button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button disabled={!payMethod || checkingAuth} onClick={() => goNext()} type="button">
            {checkingAuth ? "Verificando..." : "Continuar (Enter)"}
          </Button>
        </div>
      </Modal>

      <Modal open={step === "confirm"} onClose={() => setStep("pago")} title="Confirmar Venta">
        <div className="space-y-2">
          <p><b>Cliente:</b> {selectedClient?.name ?? "Cliente Varios"}</p>
          <p><b>Fecha y hora:</b> {nowStr}</p>
          <p><b>Pago:</b> {payMethod?.toUpperCase()}</p>
          <p><b>Items:</b> {cart.reduce((s, i) => s + i.quantity, 0)} — <b>Total:</b> S/ {total.toFixed(2)}</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setStep("pago")} type="button">Volver</Button>
            <Button onClick={() => goNext()} disabled={isProcessing} type="button">
              {isProcessing ? "Guardando..." : "Confirmar (Enter)"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Alert Dialog para autorización parental */}
      <AlertDialog open={showParentalAuth} onOpenChange={setShowParentalAuth}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Autorización Parental Requerida
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentClientForAuth ? (
                <>
                  El cliente <strong>{currentClientForAuth.fullName}</strong> no tiene una cuenta de
                  crédito activa.
                  <br /><br />
                  ¿Tiene autorización del padre o apoderado para realizar esta compra a crédito?
                </>
              ) : (
                <>
                  Para realizar ventas a crédito a "Cliente Varios" se requiere autorización del
                  padre o apoderado.
                  <br /><br />
                  ¿Tiene autorización del padre o apoderado para realizar esta compra a crédito?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleParentalAuth(false)}>No, cancelar venta</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleParentalAuth(true)}>Sí, tiene autorización</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

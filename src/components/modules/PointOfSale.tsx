// src/components/modules/PointOfSale.tsx
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
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-[min(720px,95vw)] rounded-xl bg-background border border-border shadow-xl p-4 animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} type="button">
            ✕
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
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const productRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // Navegación por teclado en el modal de clientes
  const [clientIndex, setClientIndex] = useState(0);
  const clientButtonsRef = useRef<HTMLButtonElement[]>([]);

  // Estado para autorización parental
  const [showParentalAuth, setShowParentalAuth] = useState(false);
  const [currentClientForAuth, setCurrentClientForAuth] = useState<Client | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);

  // ✅ Flag anti-rebote cuando se autoriza y se procesa
  const processingAfterAuth = useRef(false);

  // Hook que guarda en RTDB e imprime cocina si aplica
  const { flowManager, isProcessing, saveDraft, processSale } = useSaleFlow({
    onComplete: () => {
      setCart([]);
      setSelectedClient(null);
      setPayMethod(null);
      setStep("productos");
      setTimeout(() => searchInputRef.current?.focus(), 100);
      processingAfterAuth.current = false; // por si viene del flujo de autorización
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

  const updatePrice = (id: string, newPrice: number) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, price: newPrice } : i)));
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

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedProductIndex(0);
  }, [searchTerm]);

  // Scroll to highlighted product
  useEffect(() => {
    if (filteredProducts.length > 0 && highlightedProductIndex >= 0) {
      const ref = productRefs.current[highlightedProductIndex];
      if (ref) {
        ref.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedProductIndex, filteredProducts.length]);

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

  // Sincroniza índice y selección (cuando cambia la lista o se abre el modal)
  useEffect(() => {
    if (step !== "cliente") return;
    if (clientResults.length === 0) {
      setClientIndex(0);
      setSelectedClient(null);
      return;
    }
    // Si hay un seleccionado, sitúa el índice en ese elemento.
    const idx = selectedClient
      ? clientResults.findIndex((c) => c.id === selectedClient.id)
      : -1;

    const nextIndex = idx >= 0 ? idx : 0;
    setClientIndex(nextIndex);
    if (!selectedClient) {
      setSelectedClient(clientResults[nextIndex]);
    }
    // scroll a la vista
    const btn = clientButtonsRef.current[nextIndex];
    if (btn) btn.scrollIntoView({ block: "nearest" });
  }, [clientResults, step]); // eslint-disable-line

  // Si cambia el índice, asegura el scroll y la selección visible
  useEffect(() => {
    if (step !== "cliente") return;
    if (clientResults.length === 0) return;
    const safeIndex = Math.max(0, Math.min(clientResults.length - 1, clientIndex));
    const curr = clientResults[safeIndex];
    if (!curr) return;
    setSelectedClient(curr);
    const btn = clientButtonsRef.current[safeIndex];
    if (btn) btn.scrollIntoView({ block: "nearest" });
  }, [clientIndex, step]); // eslint-disable-line

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

  const handleParentalAuth = async (authorized: boolean) => {
    setShowParentalAuth(false);
    if (authorized) {
      // 🔒 evita que se dispare goNext mientras procesamos
      processingAfterAuth.current = true;
      try {
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
        // Por si el onComplete tarda, dejamos el paso en productos
        setStep("productos");
        setCart([]);
        setPayMethod(null);
        setSelectedClient(null);
      } finally {
        processingAfterAuth.current = false;
      }
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
    // ⛔ Evita avanzar si estamos procesando justo tras autorización
    if (processingAfterAuth.current) return;
    if (showParentalAuth) return;
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
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      if (payMethod === "credito") {
        setCheckingAuth(true);
        try {
          const needsAuth = await checkParentalAuth();
          if (needsAuth) return; // el modal manejará el resto
          // ✅ No requiere autorización → procesar
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
        } finally {
          setCheckingAuth(false);
        }
      }

      // No crédito → procesar directo
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
      onEnter:      showParentalAuth ? undefined : () => goNextRef.current(),
      onCtrlEnter:  showParentalAuth ? undefined : () => goNextRef.current(),
      onEsc:        showParentalAuth ? undefined : () => clearCartRef.current(),
      onF2: () => {
        if (showParentalAuth) return;
        if (cart.length > 0) { flowManager.updateCart(cart); saveDraftRef.current(); }
      },
      onCtrlS: () => {
        if (showParentalAuth) return;
        if (cart.length > 0) { flowManager.updateCart(cart); saveDraftRef.current(); }
      },
      onF3:    () => { if (!showParentalAuth) setSaleTypeRef.current("scheduled"); },
      onCtrlP: () => { if (!showParentalAuth) setSaleTypeRef.current("scheduled"); },
      onF4:    () => { if (!showParentalAuth) setSaleTypeRef.current("lunch"); },
      onCtrlL: () => { if (!showParentalAuth) setSaleTypeRef.current("lunch"); },
    });
    return unbind;
  }, [cart.length, showParentalAuth]);

  useEffect(() => { flowManager.updateCart(cart); }, [cart, flowManager]);

  const hasKitchen = cart.some((i) => i.isKitchen);
  const nowStr = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-2 sm:p-4">
        <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button variant="outline" onClick={onBack} type="button" className="flex-shrink-0">
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Volver</span>
              <span className="sm:hidden">Atrás</span>
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Punto de Venta</h1>
          </div>

          <div className="flex flex-col space-y-2 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-2">
            {/* Cliente seleccionado */}
            <div className="flex items-center px-2 py-1 rounded border text-xs sm:text-sm text-muted-foreground lg:hidden">
              <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {selectedClient ? `Cliente: ${selectedClient.name}` : "Cliente: —"}
            </div>
            <div className="hidden lg:flex items-center px-3 py-1 rounded border text-sm text-muted-foreground">
              <User className="w-4 h-4 mr-1" />
              {selectedClient ? `Cliente: ${selectedClient.name}` : "Cliente: —"}
            </div>

            <div className="flex flex-wrap gap-1 sm:gap-2">
              <Button 
                variant={saleType === "normal" ? "default" : "outline"} 
                onClick={() => setSaleType("normal")} 
                size="sm" 
                type="button"
                className="text-xs sm:text-sm flex-1 sm:flex-none"
              >
                Normal
              </Button>
              <Button 
                variant={saleType === "scheduled" ? "default" : "outline"} 
                onClick={() => setSaleType("scheduled")} 
                size="sm" 
                type="button"
                className="text-xs sm:text-sm flex-1 sm:flex-none"
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> 
                <span className="hidden sm:inline">Programada (F3)</span>
                <span className="sm:hidden">Programada</span>
              </Button>
              <Button 
                variant={saleType === "lunch" ? "default" : "outline"} 
                onClick={() => setSaleType("lunch")} 
                size="sm" 
                type="button"
                className="text-xs sm:text-sm flex-1 sm:flex-none"
              >
                <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> 
                <span className="hidden sm:inline">Almuerzos (F4)</span>
                <span className="sm:hidden">Almuerzos</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Productos */}
        <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
          <div className="mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (step !== "productos") return;
                  
                  // Calculate grid columns based on screen size
                  const getColumnsCount = () => {
                    const width = window.innerWidth;
                    if (width >= 1536) return 5; // 2xl
                    if (width >= 1280) return 4; // xl
                    if (width >= 1024) return 3; // lg
                    if (width >= 768) return 4;  // md
                    if (width >= 640) return 3;  // sm
                    return 2; // mobile
                  };
                  
                  const columns = getColumnsCount();
                  const maxIndex = filteredProducts.length - 1;
                  
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setHighlightedProductIndex((prev) => 
                      prev < maxIndex ? prev + 1 : prev
                    );
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setHighlightedProductIndex((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedProductIndex((prev) => 
                      Math.min(prev + columns, maxIndex)
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedProductIndex((prev) => Math.max(prev - columns, 0));
                  } else if (e.key === "Enter" && filteredProducts.length > 0) {
                    e.preventDefault();
                    const product = filteredProducts[highlightedProductIndex];
                    if (product) {
                      addToCart(product);
                      setSearchTerm("");
                      setHighlightedProductIndex(0);
                      // Return focus to search after adding to cart
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }
                  }
                }}
                className="pl-10 text-base sm:text-lg h-10 sm:h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {filteredProducts.map((p: any, index: number) => (
              <Card
                key={p.id}
                ref={(el) => {
                  productRefs.current[index] = el;
                }}
                className={`cursor-pointer hover:shadow-medium transition-all duration-200 group border-2 ${
                  index === highlightedProductIndex && step === "productos"
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "hover:border-primary"
                }`}
                onClick={() => {
                  addToCart(p);
                  setSearchTerm("");
                  setHighlightedProductIndex(0);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
              >
                <CardContent className="p-0">
                  <div className="relative">
                    <img src={p.image} alt={p.name} className="w-full h-24 sm:h-32 md:h-40 object-cover rounded-t-lg" />
                    {p.isKitchen && (
                      <Badge className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-pos-kitchen text-foreground text-xs">
                        <Utensils className="w-2 h-2 sm:w-3 sm:h-3 mr-1" /> Cocina
                      </Badge>
                    )}
                  </div>

                  <div className="p-2 sm:p-3">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors text-sm sm:text-base line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-1 sm:mb-2 hidden sm:block">{p.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-lg font-bold text-primary">S/ {(p.price || 0).toFixed(2)}</span>
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Carrito */}
        <div className="w-full lg:w-96 bg-pos-checkout border-t lg:border-t-0 lg:border-l border-border flex flex-col max-h-96 lg:max-h-none">
          <div className="p-2 sm:p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-pos-checkout-foreground flex items-center">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Carrito ({cart.length})
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => clearCart()} type="button">
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-4 sm:py-8">
                <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-2 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Tu carrito está vacío</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Agrega productos para comenzar</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.id} className="bg-background border border-border">
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                          <h4 className="font-medium text-foreground text-sm sm:text-base truncate">{item.name}</h4>
                          {item.isKitchen && <Badge variant="secondary" className="text-xs flex-shrink-0">Cocina</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs sm:text-sm text-muted-foreground">S/</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.price === 0 ? "" : item.price.toFixed(2)}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow empty, digits, and one decimal point
                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                const num = parseFloat(val);
                                if (!isNaN(num) && num >= 0) {
                                  updatePrice(item.id, num);
                                } else if (val === "" || val === ".") {
                                  // Keep the current state for partial input
                                  return;
                                }
                              }
                            }}
                            onFocus={(e) => {
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              const num = parseFloat(val);
                              if (isNaN(num) || num < 0) {
                                updatePrice(item.id, 0);
                              } else {
                                updatePrice(item.id, num);
                              }
                            }}
                            className="h-6 w-16 text-xs text-center"
                          />
                          <span className="text-xs sm:text-sm text-muted-foreground">c/u</span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-primary">Total: S/ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-1 flex-shrink-0">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            type="button"
                            className="h-6 w-6 p-0 sm:h-8 sm:w-8"
                          >
                            <Minus className="w-2 h-2 sm:w-3 sm:h-3" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              updateQuantity(item.id, val);
                            }}
                            onFocus={(e) => e.target.select()}
                            className="h-6 w-12 sm:w-14 text-center text-sm font-medium p-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            type="button"
                            className="h-6 w-6 p-0 sm:h-8 sm:w-8"
                          >
                            <Plus className="w-2 h-2 sm:w-3 sm:h-3" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                          type="button"
                          className="h-6 w-6 p-0 sm:h-8 sm:w-8"
                        >
                          <X className="w-2 h-2 sm:w-3 sm:h-3" />
                        </Button>
                      </div>
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
          {selectedClient && (
            <div className="text-sm text-muted-foreground -mb-1">
              Seleccionado: <span className="font-medium text-foreground">{selectedClient.name}</span>
            </div>
          )}
          <Input
            autoFocus
            placeholder="Buscar cliente…"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            onKeyDown={(e) => {
              if (clientResults.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setClientIndex((i) => Math.min(i + 1, clientResults.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setClientIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const sel = clientResults[clientIndex];
                if (sel) setSelectedClient(sel);
                // avanza al próximo paso
                goNext();
              }
            }}
            className="h-14 text-lg md:text-lg"
          />
          <div className="max-h-80 overflow-y-auto border rounded-md">
            {clientResults.map((c, i) => (
              <button
                key={c.id}
                ref={(el) => {
                  clientButtonsRef.current[i] = el as HTMLButtonElement;
                }}
                className={[
                  "w-full text-left px-3 py-2",
                  i === clientIndex ? "bg-muted" : "hover:bg-muted",
                ].join(" ")}
                onClick={() => {
                  setClientIndex(i);
                  setSelectedClient(c);
                }}
                title={c.name}
                type="button"
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedClient({ id: "varios", name: "Cliente Varios" });
                setClientIndex(0);
              }}
              type="button"
            >
              Cliente Varios
            </Button>
            <Button
              onClick={() => {
                if (!selectedClient && clientResults[clientIndex]) {
                  setSelectedClient(clientResults[clientIndex]);
                }
                goNext();
              }}
              type="button"
            >
              Continuar (Enter)
            </Button>
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

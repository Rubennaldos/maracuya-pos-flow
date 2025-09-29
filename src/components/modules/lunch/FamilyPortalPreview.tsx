import React, { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Eye,
  MessageCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { SettingsT, MenuT, ProductT } from "@/components/modules/lunch/types";

// Import “flexible” del utils
import * as DateUtils from "@/components/modules/lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import { OrderLoadingAnimation } from "@/components/ui/OrderLoadingAnimation";

/* =======================
   Fallbacks con casteo a any
   ======================= */
const _formatDateForPeru =
  (DateUtils as any)?.formatDateForPeru ??
  function (d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

const getNextDaysPeru: (horizon?: number, includeToday?: boolean) => string[] =
  (DateUtils as any)?.getNextDaysPeru ??
  function (horizon = 14, includeToday = false): string[] {
    const out: string[] = [];
    const base = new Date();
    const start = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + (includeToday ? 0 : 1)
    );
    for (let i = 0; i < horizon; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push(_formatDateForPeru(d));
    }
    return out;
  };

const prettyDayEs: (yyyy_mm_dd: string) => { dayName: string; ddmm: string; label: string } =
  (DateUtils as any)?.prettyDayEs ??
  function (yyyy_mm_dd: string) {
    const [y, m, d] = (yyyy_mm_dd || "").split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = new Intl.DateTimeFormat("es-PE", { weekday: "long" })
      .format(date)
      .toLowerCase();
    const ddmm = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit" }).format(date);
    return { dayName, ddmm, label: `${dayName} ${ddmm}` };
  };

// Tipos para el carrito de prueba
type CartItem = ProductT & {
  quantity: number;
  subtotal: number;
  selectedDays?: string[];
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

// map de weekday (0=domingo ... 6=sábado) -> clave en settings.disabledDays
const WEEKDAY_KEY: Record<number, keyof NonNullable<SettingsT["disabledDays"]>> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export default function FamilyPortalPreview() {
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [menu, setMenu] = useState<MenuT>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Estados para los modales
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("primero");
  const [confirmNote, setConfirmNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [message, setMessage] = useState("");

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, menuData] = await Promise.all([
          RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings),
          RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu),
        ]);

        setSettings(settingsData || {});
        setMenu(menuData || {});

        // Establecer primera categoría como activa
        if (menuData?.categories) {
          const firstCat = Object.values(menuData.categories)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
          if (firstCat) setActiveCat(firstCat.id);
        }
      } catch (error) {
        console.error("Error loading preview data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Categorías y productos procesados
  const categories = useMemo(
    () =>
      Object.values(menu.categories || {})
        .filter((cat) => cat && typeof cat === "object")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [menu]
  );

  const productsByCategory = useMemo(() => {
    console.log("🔍 FamilyPortalPreview - Raw menu.products:", menu.products);
    
    return categories.reduce((acc, cat) => {
      const products = Object.values(menu.products || {})
        .filter((p) => p && p.categoryId === cat.id && p.active !== false)
        .sort((a, b) => {
          const positionA = typeof a.position === "number" ? a.position : 
                           typeof a.position === "string" ? parseInt(a.position) : 
                           Number.POSITIVE_INFINITY;
          const positionB = typeof b.position === "number" ? b.position : 
                           typeof b.position === "string" ? parseInt(b.position) : 
                           Number.POSITIVE_INFINITY;
          
          console.log(`🔍 Sorting ${a.name} (pos: ${a.position}) vs ${b.name} (pos: ${b.position}) = ${positionA - positionB}`);
          
          if (positionA !== positionB) return positionA - positionB;
          return a.name.localeCompare(b.name);
        });
      
      console.log(`🔍 Category ${cat.name} products:`, products.map(p => ({ name: p.name, position: p.position })));
      acc[cat.id] = products;
      return acc;
    }, {} as Record<string, ProductT[]>);
  }, [categories, menu]);

  // Días disponibles para productos variado (simple y sin año)
  const availableDays = useMemo(() => {
    const horizon = 14; // próximos 14 días
    const allNext = getNextDaysPeru(horizon, true); // incluye hoy
    const disabled = settings?.disabledDays;

    if (!disabled) return allNext;

    return allNext.filter((yyyy_mm_dd) => {
      const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const key = WEEKDAY_KEY[date.getDay()];
      return !disabled[key]; // Si no está deshabilitado, está disponible
    });
  }, [settings]);

  // Opciones { date, label } para el diálogo reutilizable
  const availableDayOptions = useMemo(
    () =>
      availableDays.map((day) => {
        const { dayName, ddmm } = prettyDayEs(day);
        return { date: day, label: `${dayName} ${ddmm}` };
      }),
    [availableDays]
  );

  // Funciones del carrito (demo - no guarda datos)
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setShowDaySelection(true);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) return;

    const subtotal = (selectedProduct.price ?? 0) * selectedDays.length;
    const cartItem: CartItem = {
      ...selectedProduct,
      quantity: selectedDays.length,
      subtotal,
      selectedDays: [...selectedDays],
    };

    setCart((prev) => [...prev, cartItem]);
    setShowDaySelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
    toast({ title: `${selectedProduct.name} agregado al carrito` });
  };

  const addToCart = (product: ProductT) => {
    if (product.type === "varied") {
      handleVariedProduct(product);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * (item.price ?? 0),
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            ...product,
            quantity: 1,
            subtotal: product.price ?? 0,
          },
        ];
      }
    });
    toast({ title: `${product.name} agregado al carrito` });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
                subtotal: (item.quantity - 1) * (item.price ?? 0),
              }
            : item
        );
      } else {
        return prev.filter((item) => item.id !== productId);
      }
    });
  };

  const clearCart = () => {
    setCart([]);
    toast({ title: "Carrito limpiado" });
  };

  // Proceso de confirmación y envío del pedido (DEMO)
  const [/*confirmStudent*/] = useState(""); // mantenido por compat
  const openConfirm = () => {
    if (cart.length === 0) {
      toast({ title: "Tu carrito está vacío", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const confirmAndPlace = async () => {
    setPosting(true);
    setShowConfirm(false);

    // Show loading animation first
    setShowLoadingAnimation(true);
  };

  const handleAnimationComplete = async () => {
    console.log("handleAnimationComplete called");
    setShowLoadingAnimation(false);
    
    try {
      await new Promise((r) => setTimeout(r, 500)); // small delay after animation

      const orderCode = `DEMO-${Date.now().toString().slice(-6)}`;

      if (settings?.whatsapp?.enabled && settings.whatsapp.phone) {
        const items = cart
          .map(
            (item) =>
              `• ${item.name} (${item.quantity}x)${
                item.selectedDays ? ` - Días: ${item.selectedDays.join(", ")}` : ""
              }`
          )
          .join("\n");

        const orderSummary =
          `🍽️ *PEDIDO DE ALMUERZO* 🍽️\n\n` +
          `👤 Cliente: Usuario de Prueba (DEMO001)\n` +
          `⏰ Recreo: ${confirmRecess === "primero" ? "Primer" : "Segundo"} recreo\n\n` +
          `📦 *Productos:*\n${items}\n\n` +
          `💰 *Total: ${PEN(total)}*\n\n` +
          `📝 Nota: ${confirmNote || "Sin observaciones"}\n\n` +
          `⚠️ *Este es un pedido de PRUEBA - No se ha guardado en la base de datos*`;

        const cleanPhone = settings.whatsapp.phone.replace(/\D/g, "");
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(orderSummary)}`;
        window.open(whatsappUrl, "_blank");
      }

      setCart([]);
      setMessage(
        `✅ Pedido ${orderCode} enviado exitosamente (MODO DEMO - No se guardó en la base de datos)`
      );
    } catch (error) {
      console.error("Error submitting order:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Hubo un problema al enviar el pedido. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setPosting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Cargando vista previa...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Vista Previa del Portal de Familias
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Esta es una simulación completa del portal de familias con todo el proceso de compra. Puedes
          agregar productos, confirmar el pedido y enviar por WhatsApp, pero los datos no se guardan.
        </div>
      </CardHeader>
      <CardContent>
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {message}
          </div>
        )}

        <div className="border rounded-lg p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">¡Hola, Usuario de Prueba!</h2>
              <Badge variant="secondary">ID: DEMO001</Badge>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Menú */}
            <div className="lg:col-span-2 space-y-4">
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCat === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveCat(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Productos */}
              <div className="space-y-3">
                {activeCat && productsByCategory[activeCat] ? (
                  productsByCategory[activeCat].map((product) => (
                    <Card key={product.id} className="p-4">
                      <div className="flex gap-4">
                        {product.image && (
                          <div className="w-20 h-20 flex-shrink-0">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg border"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-medium">{product.name}</h3>

                              {/* Info almuerzo */}
                              {product.type === "lunch" && (
                                <div className="mt-2 space-y-1">
                                  {(product as any).entrada && (
                                    <div className="text-sm text-muted-foreground">
                                      🥗 <span className="font-medium">Entrada:</span>{" "}
                                      {(product as any).entrada}
                                    </div>
                                  )}
                                  {(product as any).segundo && (
                                    <div className="text-sm text-muted-foreground">
                                      🍽️ <span className="font-medium">Segundo:</span>{" "}
                                      {(product as any).segundo}
                                    </div>
                                  )}
                                  {(product as any).postre && (
                                    <div className="text-sm text-muted-foreground">
                                      🍰 <span className="font-medium">Postre:</span>{" "}
                                      {(product as any).postre}
                                    </div>
                                  )}
                                  {(product as any).refresco && (
                                    <div className="text-sm text-muted-foreground">
                                      🥤 <span className="font-medium">Refresco:</span>{" "}
                                      {(product as any).refresco}
                                    </div>
                                  )}
                                  {product.specificDate && (
                                    <div className="text-xs text-green-600 font-medium mt-1">
                                      📅 Fecha:{" "}
                                      {(() => {
                                        const [y, m, d] = product.specificDate.split("-").map(Number);
                                        const date = new Date(y, m - 1, d);
                                        const dayName = new Intl.DateTimeFormat("es-PE", {
                                          weekday: "long",
                                        }).format(date);
                                        const ddmm = new Intl.DateTimeFormat("es-PE", {
                                          day: "2-digit",
                                          month: "2-digit",
                                        }).format(date);
                                        return `${dayName} ${ddmm}`;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}

                              {product.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  📝 <span className="font-medium">Observación:</span>{" "}
                                  {product.description}
                                </p>
                              )}

                              {product.addons && product.addons.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Agregados disponibles:
                                  </div>
                                   <div className="flex flex-wrap gap-1">
                                     {product.addons?.map((addon, idx) => (
                                       <Badge key={`${addon.id || idx}`} variant="outline" className="text-xs">
                                         {addon.name} (+{PEN(addon.price)})
                                       </Badge>
                                     ))}
                                  </div>
                                </div>
                              )}

                              {product.type === "varied" && (
                                <div className="text-xs text-blue-600 mt-1">
                                  📅 Producto variado — Selecciona días
                                </div>
                              )}

                              {settings?.showPrices && product.price && (
                                <div className="text-lg font-bold text-primary mt-2">
                                  {PEN(product.price)}
                                  {product.type === "varied" && (
                                    <span className="text-sm text-muted-foreground ml-1">
                                      por día
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <Button onClick={() => addToCart(product)} size="sm" className="ml-4">
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {categories.length === 0
                      ? "No hay categorías configuradas"
                      : "No hay productos en esta categoría"}
                  </div>
                )}
              </div>
            </div>

            {/* Carrito */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="h-4 w-4" />
                    Mi pedido ({cart.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Tu carrito está vacío
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const groupedItems = cart.reduce((groups, item) => {
                          if (item.selectedDays && item.selectedDays.length > 0) {
                            item.selectedDays.forEach((day) => {
                              if (!groups[day]) groups[day] = [];
                              groups[day].push({ ...item, specificDay: day });
                            });
                          } else {
                            const date = item.specificDate || "Sin fecha";
                            if (!groups[date]) groups[date] = [];
                            groups[date].push(item);
                          }
                          return groups;
                        }, {} as Record<string, any[]>);

                        return Object.entries(groupedItems).map(([date, items]) => (
                          <div key={date} className="border rounded-lg p-3 space-y-2">
                            <div className="text-sm font-medium text-primary border-b pb-1">
                              📅{" "}
                              {date === "Sin fecha"
                                ? "Fecha por definir"
                                : (() => {
                                    const [y, m, d] = date.split("-").map(Number);
                                    const dt = new Date(y, m - 1, d);
                                    const dayName = new Intl.DateTimeFormat("es-PE", {
                                      weekday: "long",
                                    }).format(dt);
                                    const ddmm = new Intl.DateTimeFormat("es-PE", {
                                      day: "2-digit",
                                      month: "2-digit",
                                    }).format(dt);
                                    return `${dayName} ${ddmm}`;
                                  })()}
                            </div>
                            {items.map((item, idx) => (
                              <div
                                key={`${item.id}-${date}-${idx}`}
                                className="flex justify-between items-center p-2 border rounded bg-muted/30"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{item.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {PEN(item.price ?? 0)} × {item.quantity} ={" "}
                                    {PEN((item.price ?? 0) * item.quantity)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeFromCart(item.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-sm w-6 text-center">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addToCart(item)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}

                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center font-bold">
                          <span>Total:</span>
                          <span>{PEN(cart.reduce((sum, item) => sum + item.subtotal, 0))}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Button className="w-full" onClick={openConfirm} disabled={cart.length === 0}>
                          Confirmar Pedido (Demo)
                        </Button>
                        <Button variant="outline" className="w-full" onClick={clearCart}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpiar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center mt-6 pt-4 border-t text-xs text-muted-foreground">
            Maracuyá • Portal de Almuerzos • Vista Previa de Administrador
          </div>
        </div>

        {/* Modal de selección de días (reutilizable) */}
        <SelectDaysDialog
          open={showDaySelection}
          onOpenChange={setShowDaySelection}
          productName={selectedProduct?.name}
          pricePerDay={selectedProduct?.price}
          days={availableDayOptions}
          selectedDays={selectedDays}
          onToggleDay={(date, checked) =>
            setSelectedDays((prev) => (checked ? [...prev, date] : prev.filter((d) => d !== date)))
          }
          onConfirm={addVariedToCart}
          confirmDisabled={selectedDays.length === 0}
          disabledDays={settings?.disabledDays}
        />

        {/* Modal de confirmación */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Confirmar pedido
              </DialogTitle>
              <DialogDescription>Revisa los detalles de tu pedido antes de enviarlo</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Resumen del pedido:</h4>
                {cart.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {item.name} (×{item.quantity})
                      </span>
                      <span>{PEN(item.subtotal)}</span>
                    </div>
                    {item.selectedDays && (
                      <div className="text-xs text-muted-foreground ml-2">
                        Días: {item.selectedDays.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                <div className="border-t pt-2 font-bold flex justify-between">
                  <span>Total:</span>
                  <span>{PEN(total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="text-sm">
                    <strong>Cliente:</strong> Usuario de Prueba (DEMO001)
                  </div>
                </div>

                <div>
                  <Label>Recreo de entrega</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "primero"}
                        onCheckedChange={(checked) => checked && setConfirmRecess("primero")}
                      />
                      <Label>Primer recreo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "segundo"}
                        onCheckedChange={(checked) => checked && setConfirmRecess("segundo")}
                      />
                      <Label>Segundo recreo</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="note">Observaciones (opcional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Alguna indicación especial..."
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {settings?.whatsapp?.enabled && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Se enviará confirmación por WhatsApp (DEMO)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmAndPlace} disabled={posting} className="bg-green-600 hover:bg-green-700">
                {posting ? <>Enviando pedido...</> : <>Enviar pedido</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Loading Animation */}
        <OrderLoadingAnimation
          open={showLoadingAnimation}
          onComplete={handleAnimationComplete}
        />
      </CardContent>
    </Card>
  );
}

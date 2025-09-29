import React, { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ShoppingCart, Plus, Minus, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { SettingsT, MenuT, ProductT } from "@/components/modules/lunch/types";
import * as DateUtils from "@/components/modules/lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import AddonsSelectorDialog from "@/components/modules/lunch/preview/AddonsSelectorDialog";

type Mode = "preview" | "live";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

const WEEKDAY_KEY: Record<number, keyof NonNullable<SettingsT["disabledDays"]>> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const _formatDateForPeru =
  (DateUtils as any)?.formatDateForPeru ??
  function (d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

const getNextDaysPeru: (h?: number, includeToday?: boolean) => string[] =
  (DateUtils as any)?.getNextDaysPeru ??
  function (h = 14, includeToday = false) {
    const out: string[] = [];
    const base = new Date();
    const start = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + (includeToday ? 0 : 1),
    );
    for (let i = 0; i < h; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push(_formatDateForPeru(d));
    }
    return out;
  };

const prettyDayEs: (yyyy_mm_dd: string) => { dayName: string; ddmm: string } =
  (DateUtils as any)?.prettyDayEs ??
  function (yyyy_mm_dd: string) {
    const [y, m, d] = (yyyy_mm_dd || "").split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = new Intl.DateTimeFormat("es-PE", { weekday: "long" })
      .format(date)
      .toLowerCase();
    const ddmm = new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return { dayName, ddmm };
  };

type CartItem = ProductT & {
  quantity: number;
  subtotal: number;
  selectedDays?: string[];
  selectedAddons?: { [addonId: string]: number };
  addonsPrice?: number;
};

export default function FamilyPortalApp({
  mode,
  demoClient,
}: {
  mode: Mode;
  demoClient?: { id: string; name: string };
}) {
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [menu, setMenu] = useState<MenuT>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");

  // Modales
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [showAddonsSelection, setShowAddonsSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ [addonId: string]: number }>({});
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("primero");
  const [confirmNote, setConfirmNote] = useState("");

  // Carga inicial
  useEffect(() => {
    (async () => {
      const [settingsData, menuData] = await Promise.all([
        RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings),
        RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu),
      ]);
      setSettings(settingsData || {});
      setMenu(menuData || {});
      if (menuData?.categories) {
        const first = Object.values(menuData.categories).sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        )[0];
        if (first) setActiveCat(first.id);
      }
    })().catch((e) => console.error(e));
  }, []);

  // Datos procesados
  const categories = useMemo(
    () =>
      Object.values((menu as any).categories || {})
        .filter((cat: any) => cat && typeof cat === "object")
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [menu],
  );

  const productsByCategory = useMemo(() => {
    return categories.reduce((acc, cat: any) => {
      const products = Object.values((menu as any).products || {})
        .filter((p: any) => p && p.categoryId === cat.id && p.active !== false)
        .sort((a: any, b: any) => {
          const pa = typeof a.position === "number" ? a.position : Number(a.position ?? Infinity);
          const pb = typeof b.position === "number" ? b.position : Number(b.position ?? Infinity);
          return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
        });
      (acc as any)[cat.id] = products as ProductT[];
      return acc;
    }, {} as Record<string, ProductT[]>);
  }, [categories, menu]);

  const availableDays = useMemo(() => {
    const next = getNextDaysPeru(14, true);
    const disabled = settings?.disabledDays;
    if (!disabled) return next;
    return next.filter((yyyy_mm_dd) => {
      const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const key = WEEKDAY_KEY[date.getDay()];
      return !disabled[key];
    });
  }, [settings]);

  const availableDayOptions = useMemo(
    () =>
      availableDays.map((day) => {
        const { dayName, ddmm } = prettyDayEs(day);
        return { date: day, label: `${dayName} ${ddmm}` };
      }),
    [availableDays],
  );

  // Carrito
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setSelectedAddons({});
    if (product.addons && product.addons.length > 0) {
      setShowAddonsSelection(true);
    } else {
      setShowDaySelection(true);
    }
  };

  const proceedToDaySelection = () => {
    setShowAddonsSelection(false);
    setShowDaySelection(true);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) return;

    const addonsPrice = Object.entries(selectedAddons).reduce((tot, [addonId, qty]) => {
      const addon = selectedProduct.addons?.find((a) => a.id === addonId);
      return tot + (addon?.price || 0) * qty;
    }, 0);

    const price = (selectedProduct.price ?? 0) + addonsPrice;
    const subtotal = price * selectedDays.length;

    const ci: CartItem = {
      ...selectedProduct,
      quantity: selectedDays.length,
      subtotal,
      selectedDays: [...selectedDays],
      selectedAddons: Object.keys(selectedAddons).length ? { ...selectedAddons } : undefined,
      addonsPrice,
    };

    setCart((prev) => [...prev, ci]);
    setShowDaySelection(false);
    setShowAddonsSelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
    setSelectedAddons({});
    toast({ title: `${selectedProduct.name} agregado al carrito` });
  };

  const addToCart = (product: ProductT | CartItem) => {
    const p = product as ProductT;
    if (p.type === "varied" && !(product as CartItem).selectedDays) {
      handleVariedProduct(p);
      return;
    }
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) {
        return prev.map((i) =>
          i.id === p.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: ((i.price ?? 0) + (i.addonsPrice ?? 0)) * (i.quantity + 1),
              }
            : i,
        );
      }
      return [
        ...prev,
        { ...(p as ProductT), quantity: 1, subtotal: (p.price ?? 0) + ((p as any).addonsPrice ?? 0) },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === productId);
      if (ex && ex.quantity > 1) {
        return prev.map((i) =>
          i.id === productId
            ? {
                ...i,
                quantity: i.quantity - 1,
                subtotal: ((i.price ?? 0) + (i.addonsPrice ?? 0)) * (i.quantity - 1),
              }
            : i,
        );
      }
      return prev.filter((i) => i.id !== productId);
    });
  };

  const total = cart.reduce((s, i) => s + i.subtotal, 0);

  const confirmOrder = async () => {
    if (cart.length === 0) {
      toast({ title: "Tu carrito está vacío", variant: "destructive" });
      return;
    }

    if (mode === "preview") {
      if (settings?.whatsapp?.enabled && settings.whatsapp.phone) {
        const items = cart
          .map(
            (it) =>
              `• ${it.name} (${it.quantity}x)${
                it.selectedDays ? ` - Días: ${it.selectedDays.join(", ")}` : ""
              }`,
          )
          .join("\n");
        const clean = settings.whatsapp.phone.replace(/\D/g, "");
        const msg =
          `🍽️ *PEDIDO (DEMO)*\n\n` +
          `👤 ${demoClient?.name ?? "Usuario"} (${demoClient?.id ?? "DEMO"})\n` +
          `⏰ Recreo: ${confirmRecess}\n\n` +
          `📦\n${items}\n\n` +
          `💰 Total: ${PEN(total)}\n` +
          `📝 Nota: ${confirmNote || "Sin observaciones"}\n` +
          `⚠️ Este es un *modo PREVIEW*.`;
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, "_blank");
      }
      toast({ title: "Pedido simulado (preview)" });
      setCart([]);
      return;
    }

    // ====== LIVE (conecta aquí tu persistencia real) ======
    try {
      // TODO: guardar en RTDB o backend
      toast({ title: "Pedido enviado (live)" });
      setCart([]);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo enviar el pedido", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-3 md:px-6 py-4">
      {/* Header */}
      <div className="mb-3">
        {demoClient?.id && (
          <div className="text-sm text-muted-foreground">Código: {demoClient.id}</div>
        )}
        <h2 className="text-lg font-semibold">¡Hola, {demoClient?.name ?? "Usuario"}!</h2>
      </div>

      {/* Tabs de categorías (simple) */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat: any) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Grid de productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeCat && productsByCategory[activeCat]?.length ? (
            (productsByCategory[activeCat] as ProductT[]).map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex gap-4">
                  {p.image && (
                    <div className="w-20 h-20 flex-shrink-0">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{p.name}</h3>

                        {p.type === "lunch" && (
                          <div className="mt-2 space-y-1">
                            {(p as any).entrada && (
                              <div className="text-sm text-muted-foreground">
                                🥗 <span className="font-medium">Entrada:</span> {(p as any).entrada}
                              </div>
                            )}
                            {(p as any).segundo && (
                              <div className="text-sm text-muted-foreground">
                                🍽️ <span className="font-medium">Segundo:</span> {(p as any).segundo}
                              </div>
                            )}
                            {(p as any).postre && (
                              <div className="text-sm text-muted-foreground">
                                🍰 <span className="font-medium">Postre:</span> {(p as any).postre}
                              </div>
                            )}
                            {(p as any).refresco && (
                              <div className="text-sm text-muted-foreground">
                                🥤 <span className="font-medium">Refresco:</span> {(p as any).refresco}
                              </div>
                            )}
                            {p.specificDate && (
                              <div className="text-xs text-green-600 font-medium mt-1">
                                📅 Fecha:{" "}
                                {(() => {
                                  const [y, m, d] = p.specificDate.split("-").map(Number);
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

                        {p.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            📝 <span className="font-medium">Observación:</span> {p.description}
                          </p>
                        )}

                        {p.addons && p.addons.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Agregados disponibles:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {p.addons?.map((a, idx) => (
                                <Badge key={`${a.id || idx}`} variant="outline" className="text-xs">
                                  {a.name} (+{PEN(a.price)})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.type === "varied" && (
                          <div className="text-xs text-blue-600 mt-1">
                            📅 Producto variado — Selecciona días
                          </div>
                        )}

                        {settings?.showPrices && p.price && (
                          <div className="text-lg font-bold text-primary mt-2">
                            {PEN(p.price)}
                            {p.type === "varied" && (
                              <span className="text-sm text-muted-foreground ml-1">por día</span>
                            )}
                          </div>
                        )}
                      </div>

                      <Button onClick={() => addToCart(p)} size="sm" className="ml-4">
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {categories.length === 0 ? "No hay categorías configuradas" : "No hay productos en esta categoría"}
            </div>
          )}
        </div>

        {/* Sidebar carrito */}
        <Card className="p-3 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Mi pedido ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Tu carrito está vacío</div>
            ) : (
              <>
                {(() => {
                  const groups = cart.reduce((g, item) => {
                    if (item.selectedDays?.length) {
                      item.selectedDays.forEach((day) => {
                        if (!g[day]) g[day] = [];
                        g[day].push({ ...item, specificDay: day });
                      });
                    } else {
                      const date = item.specificDate || "Sin fecha";
                      if (!g[date]) g[date] = [];
                      g[date].push(item);
                    }
                    return g;
                  }, {} as Record<string, any[]>);

                  return Object.entries(groups).map(([date, items]) => (
                    <div key={date} className="border rounded-lg p-3 space-y-2">
                      <div className="text-sm font-medium text-primary border-b pb-1">
                        📅{" "}
                        {date === "Sin fecha"
                          ? "Fecha por definir"
                          : (() => {
                              const [y, m, d] = date.split("-").map(Number);
                              const dt = new Date(y, m - 1, d);
                              const dayName = new Intl.DateTimeFormat("es-PE", { weekday: "long" }).format(dt);
                              const ddmm = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit" }).format(dt);
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
                              {PEN(item.price ?? 0)} × {item.quantity}
                              {item.addonsPrice && item.addonsPrice > 0 && <span> + {PEN(item.addonsPrice)} agregados</span>}
                              {" = "} {PEN(((item.price ?? 0) + (item.addonsPrice ?? 0)) * item.quantity)}
                            </div>
                            {item.selectedAddons && Object.keys(item.selectedAddons).length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Agregados:{" "}
                                {Object.entries(item.selectedAddons)
                                  .map(([addonId, qty]) => {
                                    const addon = item.addons?.find((a: any) => a.id === addonId);
                                    return addon ? `${addon.name} (×${qty})` : "";
                                  })
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
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
                    <span>{PEN(total)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <div className="text-sm">
                      <strong>Cliente:</strong> {demoClient?.name ?? "Usuario"} ({demoClient?.id ?? "—"})
                    </div>
                    <div className="mt-2 flex gap-4">
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

                    <div className="mt-3">
                      <Label htmlFor="note">Observaciones (opcional)</Label>
                      <Textarea
                        id="note"
                        placeholder="Alguna indicación especial..."
                        value={confirmNote}
                        onChange={(e) => setConfirmNote(e.target.value)}
                        rows={2}
                      />
                    </div>

                    {settings?.whatsapp?.enabled && (
                      <div className="mt-2 flex items-center gap-2 text-green-800 text-sm">
                        <MessageCircle className="h-4 w-4" />
                        Se enviará confirmación por WhatsApp
                      </div>
                    )}
                  </div>

                  <Button className="w-full" onClick={confirmOrder} disabled={cart.length === 0}>
                    Confirmar pedido
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diálogos reutilizables */}
      <AddonsSelectorDialog
        open={showAddonsSelection}
        onOpenChange={setShowAddonsSelection}
        productName={selectedProduct?.name}
        addons={selectedProduct?.addons || []}
        selectedAddons={selectedAddons}
        onAddonsChange={setSelectedAddons}
        onConfirm={proceedToDaySelection}
        confirmDisabled={false}
      />

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
    </div>
  );
}

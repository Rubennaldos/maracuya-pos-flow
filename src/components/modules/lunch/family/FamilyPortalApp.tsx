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

// utils flexibles (con fallbacks)
import * as DateUtils from "@/components/modules/lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import AddonsSelectorDialog from "@/components/modules/lunch/preview/AddonsSelectorDialog";
import { OrderLoadingAnimation } from "@/components/ui/OrderLoadingAnimation";

// Helper WhatsApp (abre sin bloqueo)
import { normalizePhone, buildWaUrl, openWhatsAppNow } from "./openWhatsApp";

type Mode = "preview" | "live";

export interface FamilyPortalAppProps {
  /** "preview" = modo demo (no guarda), "live" = portal real (sí guarda) */
  mode: Mode;
  /** Datos del cliente (en preview puedes pasar un demo) */
  client?: { id: string; name: string };
  /** Teléfono para WhatsApp; si no se pasa, usa settings.whatsapp.phone (si existe) */
  whatsappPhoneOverride?: string;
  /** Persistencia (solo se usa en modo live). Debe lanzar error si falla */
  onPlaceOrder?: (payload: any) => Promise<void>;
}

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

type CartItem = ProductT & {
  quantity: number;
  subtotal: number;
  selectedDays?: string[];
  selectedAddons?: { [addonId: string]: number };
  addonsPrice?: number;
};

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

export default function FamilyPortalApp({
  mode,
  client,
  whatsappPhoneOverride,
  onPlaceOrder,
}: FamilyPortalAppProps) {
  const isPreview = mode === "preview";
  const clientName = client?.name ?? "Usuario de Prueba";
  const clientId = client?.id ?? "DEMO001";

  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [menu, setMenu] = useState<MenuT>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Modales
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [showAddonsSelection, setShowAddonsSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ [addonId: string]: number }>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("primero");
  const [confirmNote, setConfirmNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false); // mantenemos por compat
  const [message, setMessage] = useState("");

  // Carga inicial
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, menuData] = await Promise.all([
          RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings),
          RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu),
        ]);
        setSettings(settingsData || {});
        setMenu(menuData || {});
        if (menuData?.categories) {
          const firstCat = Object.values(menuData.categories)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
          if (firstCat) setActiveCat(firstCat.id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Categorías
  const categories = useMemo(
    () =>
      Object.values(menu.categories || {})
        .filter((c) => c && typeof c === "object")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [menu]
  );

  // Productos por categoría
  const productsByCategory = useMemo(() => {
    return categories.reduce((acc, cat) => {
      const products = Object.values(menu.products || {})
        .filter((p) => p && p.categoryId === cat.id && p.active !== false)
        .sort((a, b) => {
          const pa = typeof (a as any).position === "number"
            ? (a as any).position
            : typeof (a as any).position === "string"
              ? parseInt((a as any).position)
              : Number.POSITIVE_INFINITY;
          const pb = typeof (b as any).position === "number"
            ? (b as any).position
            : typeof (b as any).position === "string"
              ? parseInt((b as any).position)
              : Number.POSITIVE_INFINITY;
          if (pa !== pb) return pa - pb;
          return a.name.localeCompare(b.name);
        }) as ProductT[];
      (acc as any)[cat.id] = products;
      return acc;
    }, {} as Record<string, ProductT[]>);
  }, [categories, menu]);

  // Días disponibles
  const availableDays = useMemo(() => {
    const all = getNextDaysPeru(14, true);
    const disabled = settings?.disabledDays;
    if (!disabled) return all;
    return all.filter((ymd) => {
      const [y, m, d] = ymd.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const key = WEEKDAY_KEY[dt.getDay()];
      return !disabled[key];
    });
  }, [settings]);

  const availableDayOptions = useMemo(
    () =>
      availableDays.map((day) => {
        const { dayName, ddmm } = prettyDayEs(day);
        return { date: day, label: `${dayName} ${ddmm}` };
      }),
    [availableDays]
  );

  // —— carrito
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setSelectedAddons({});
    if (product.addons?.length) setShowAddonsSelection(true);
    else setShowDaySelection(true);
  };

  const proceedToDaySelection = () => {
    setShowAddonsSelection(false);
    setShowDaySelection(true);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) return;
    const addonsPrice = Object.entries(selectedAddons).reduce((t, [id, qty]) => {
      const addon = selectedProduct.addons?.find((a) => a.id === id);
      return t + (addon?.price || 0) * qty;
    }, 0);
    const base = selectedProduct.price ?? 0;
    const perDay = base + addonsPrice;
    const subtotal = perDay * selectedDays.length;

    const item: CartItem = {
      ...selectedProduct,
      quantity: selectedDays.length,
      subtotal,
      selectedDays: [...selectedDays],
      selectedAddons: Object.keys(selectedAddons).length ? { ...selectedAddons } : undefined,
      addonsPrice,
    };

    setCart((p) => [...p, item]);
    setShowDaySelection(false);
    setShowAddonsSelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
    setSelectedAddons({});
    toast({ title: `${selectedProduct.name} agregado al carrito` });
  };

  const addToCart = (product: ProductT) => {
    if (product.type === "varied") return handleVariedProduct(product);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * (i.price ?? 0) }
            : i
        );
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price ?? 0 }];
    });
    toast({ title: `${product.name} agregado al carrito` });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === productId);
      if (ex && ex.quantity > 1) {
        return prev.map((i) =>
          i.id === productId
            ? { ...i, quantity: i.quantity - 1, subtotal: (i.quantity - 1) * (i.price ?? 0) }
            : i
        );
      }
      return prev.filter((i) => i.id !== productId);
    });
  };

  const clearCart = () => {
    setCart([]);
    toast({ title: "Carrito limpiado" });
  };

  const openConfirm = () => {
    if (!cart.length) return toast({ title: "Tu carrito está vacío", variant: "destructive" });
    setShowConfirm(true);
  };

  const total = cart.reduce((s, i) => s + i.subtotal, 0);

  const buildOrderPayload = () => ({
    clientCode: clientId,
    clientName,
    note: confirmNote || "",
    recess: confirmRecess,
    status: "pending",
    total,
    createdAt: Date.now(),
    items: cart.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.quantity,
      price: i.price ?? 0,
      selectedDays: i.selectedDays,
      specificDate: i.specificDate,
      addons: i.selectedAddons,
    })),
  });

  /** Construye el mensaje de WA */
  const makeWaMessage = () => {
    const lines = cart.map(
      (i) =>
        `• ${i.name} (${i.quantity}x)` +
        (i.selectedDays?.length ? ` - Días: ${i.selectedDays.join(", ")}` : "")
    );
    const rec = confirmRecess === "primero" ? "Primer" : "Segundo";
    return (
      `🍽️ *PEDIDO DE ALMUERZO*${isPreview ? " (DEMO)" : ""}\n\n` +
      `👤 ${clientName} (${clientId})\n` +
      `⏰ Recreo: ${rec} recreo\n\n` +
      `📦 *Productos:*\n${lines.join("\n")}\n\n` +
      `💰 *Total:* ${PEN(total)}\n` +
      `📝 Nota: ${confirmNote || "Sin observaciones"}`
    );
  };

  /** Confirmar y abrir WhatsApp INMEDIATAMENTE (evita pop-up blocking) */
  const confirmNow = async () => {
    if (cart.length === 0) {
      toast({ title: "Tu carrito está vacío", variant: "destructive" });
      return;
    }

    setPosting(true);
    setShowConfirm(false);

    // 1) Abrir WhatsApp YA (mismo gesto de click)
    const rawPhone = whatsappPhoneOverride ?? (settings?.whatsapp?.enabled ? settings?.whatsapp?.phone : "");
    const phoneDigits = normalizePhone(rawPhone || "");
    if (!phoneDigits) {
      setPosting(false);
      toast({ title: "Teléfono de WhatsApp inválido", description: "Configura un número con código de país.", variant: "destructive" });
      return;
    }
    const url = buildWaUrl(phoneDigits, makeWaMessage());
    openWhatsAppNow(url); // navega a WhatsApp en la misma pestaña

    // 2) Guardar (si live) sin bloquear al usuario
    try {
      const payload = buildOrderPayload();
      if (!isPreview) {
        if (!onPlaceOrder) throw new Error("onPlaceOrder no proporcionado en modo live");
        await onPlaceOrder(payload);
        setMessage("✅ Pedido enviado correctamente.");
      } else {
        setMessage("✅ Pedido DEMO simulado (no se guardó en la base de datos).");
      }
      setCart([]);
    } catch (e) {
      console.error(e);
      // El usuario ya salió a WhatsApp; registramos el error y mostramos toast si regresa
      toast({ title: "No se pudo guardar el pedido", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  // (Compat) Si en algún flujo quieres mostrar la animación, puedes usar estas dos:
  const confirmAndPlace = async () => {
    // Si prefieres animación antes de abrir WA, quita el confirmNow del botón y usa este método.
    // Nota: abrir WA después de animaciones puede ser bloqueado por el navegador.
    setShowConfirm(false);
    setShowLoadingAnimation(true);
  };

  const handleAnimationComplete = async () => {
    setShowLoadingAnimation(false);
    // Abrir WhatsApp aquí puede ser bloqueado; por eso preferimos confirmNow directamente.
    await confirmNow();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Cargando vista…</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {isPreview ? "Vista Previa del Portal de Familias" : "Portal de Familias"}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {isPreview
            ? "Simulación completa. Puedes agregar productos, confirmar y enviar por WhatsApp (no guarda datos)."
            : `Sesión de ${clientName} (${clientId}).`}
        </div>
      </CardHeader>

      <CardContent>
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {message}
          </div>
        )}

        <div className="rounded-lg p-4 border bg-white">
          {/* Encabezado compacto como familias */}
          <div className="bg-green-50 border border-green-200 p-3 rounded-md mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm">¡Hola, {clientName}!</div>
              <div className="text-xs text-muted-foreground">Código: {clientId}</div>
            </div>
            {isPreview && <Badge variant="secondary">Vista previa</Badge>}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Columna de productos (2/3) */}
            <div className="lg:col-span-2">
              {/* Pills de categorías */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCat === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveCat(cat.id)}
                      className="rounded-full"
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Grilla de tarjetas */}
              {activeCat && productsByCategory[activeCat]?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {productsByCategory[activeCat].map((product) => (
                    <div
                      key={product.id}
                      className="rounded-lg border bg-white overflow-hidden hover:shadow-sm transition"
                    >
                      {/* Imagen */}
                      <div className="w-full h-40 bg-muted/40 overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sin imagen
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="p-3">
                        <div className="text-sm font-medium mb-1 line-clamp-1">{product.name}</div>

                        {settings?.showPrices && typeof product.price === "number" && (
                          <div className="text-sm font-semibold text-primary">
                            {PEN(product.price)}
                            {product.type === "varied" && (
                              <span className="ml-1 text-xs text-muted-foreground">por día</span>
                            )}
                          </div>
                        )}

                        <div className="mt-2 flex justify-end">
                          <Button size="sm" onClick={() => addToCart(product)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  {categories.length ? "No hay productos en esta categoría" : "No hay categorías configuradas"}
                </div>
              )}
            </div>

            {/* Carrito (1/3) */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="h-4 w-4" />
                    Tu pedido
                    <span className="text-muted-foreground font-normal">({cart.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Tu carrito está vacío
                    </div>
                  ) : (
                    <>
                      {/* Agrupar por fecha cuando corresponda (igual UX) */}
                      {(() => {
                        const groups = cart.reduce((acc, item) => {
                          if (item.selectedDays?.length) {
                            item.selectedDays.forEach((d) => {
                              (acc[d] ||= []).push({ ...item, _d: d });
                            });
                          } else {
                            const k = item.specificDate || "Sin fecha";
                            (acc[k] ||= []).push(item);
                          }
                          return acc;
                        }, {} as Record<string, any[]>);

                        return Object.entries(groups).map(([date, items]) => (
                          <div key={date} className="border rounded p-2 space-y-2">
                            <div className="text-xs font-medium text-primary border-b pb-1">
                              📅{" "}
                              {date === "Sin fecha"
                                ? "Fecha por definir"
                                : (() => {
                                    const [y, m, d] = date.split("-").map(Number);
                                    const dt = new Date(y, m - 1, d);
                                    const day = new Intl.DateTimeFormat("es-PE", { weekday: "long" }).format(dt);
                                    const ddmm = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit" }).format(dt);
                                    return `${day} ${ddmm}`;
                                  })()}
                            </div>
                            {items.map((it, idx) => (
                              <div
                                key={`${it.id}-${date}-${idx}`}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{it.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {PEN(it.price ?? 0)} × {it.quantity}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => removeFromCart(it.id)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center">{it.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => addToCart(it)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}

                      <div className="border-t pt-3 mt-3 flex items-center justify-between font-semibold">
                        <span>Total</span>
                        <span>{PEN(total)}</span>
                      </div>

                      <div className="space-y-2">
                        {/* Datos de entrega */}
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <div className="text-sm">
                            <strong>Cliente:</strong> {clientName} ({clientId})
                          </div>
                          <div className="mt-2 flex gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={confirmRecess === "primero"}
                                onCheckedChange={(c) => c && setConfirmRecess("primero")}
                              />
                              <Label>Primer recreo</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={confirmRecess === "segundo"}
                                onCheckedChange={(c) => c && setConfirmRecess("segundo")}
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

                          {(whatsappPhoneOverride || settings?.whatsapp?.enabled) && (
                            <div className="mt-2 flex items-center gap-2 text-green-800 text-sm">
                              <MessageCircle className="h-4 w-4" />
                              Se enviará confirmación por WhatsApp
                            </div>
                          )}
                        </div>

                        {/* Usa confirmNow para abrir WA sin bloqueo */}
                        <Button className="w-full" onClick={confirmNow} disabled={!cart.length || posting}>
                          {isPreview ? "Confirmar Pedido (Demo)" : "Confirmar Pedido"}
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
            Maracuyá • Portal de Almuerzos {isPreview && "• Vista Previa de Administrador"}
          </div>
        </div>

        {/* Modales */}
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

        {/* Confirmación (sigue disponible si prefieres flujo con modal) */}
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
                <h4 className="font-medium">Resumen del pedido</h4>
                {cart.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="flex justify-between">
                      <span>{item.name} (×{item.quantity})</span>
                      <span>{PEN(item.subtotal)}</span>
                    </div>
                    {item.selectedDays?.length ? (
                      <div className="text-xs text-muted-foreground ml-2">
                        Días: {item.selectedDays.join(", ")}
                      </div>
                    ) : null}
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
                    <strong>Cliente:</strong> {clientName} ({clientId})
                  </div>
                </div>

                <div>
                  <Label>Recreo de entrega</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "primero"}
                        onCheckedChange={(c) => c && setConfirmRecess("primero")}
                      />
                      <Label>Primer recreo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "segundo"}
                        onCheckedChange={(c) => c && setConfirmRecess("segundo")}
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

              {(whatsappPhoneOverride || settings?.whatsapp?.enabled) && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Se enviará confirmación por WhatsApp
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              {/* También abrimos WA desde el modal sin animación */}
              <Button onClick={confirmNow} disabled={posting} className="bg-green-600 hover:bg-green-700">
                {posting ? "Enviando pedido..." : "Enviar pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Animación (opcional / compat) */}
        <OrderLoadingAnimation open={showLoadingAnimation} onComplete={handleAnimationComplete} />
      </CardContent>
    </Card>
  );
}

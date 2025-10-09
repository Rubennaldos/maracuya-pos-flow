import React, { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DollarSign,
  Receipt,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { SettingsT, MenuT, ProductT } from "@/components/modules/lunch/types";
import PaymentsModule from "./PaymentsModule";

// Animaciones
import { motion } from "framer-motion";

// utils flexibles (con fallbacks)
import * as DateUtils from "@/components/modules/lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import AddonsSelectorDialog from "@/components/modules/lunch/preview/AddonsSelectorDialog";
import { OrderLoadingAnimation } from "@/components/ui/OrderLoadingAnimation";

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

/* ===== Helpers WhatsApp (locales) ===== */
const normalizePhone = (raw: string) => (raw || "").replace(/\D/g, "");
const buildWaUrl = (digits: string, msg: string) =>
  `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
const openWhatsAppNow = (url: string) => {
  // Abrir en la MISMA pestaña minimiza el bloqueo de popups
  window.location.href = url;
};

// Helpers de fecha (fallbacks)
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

// UX helpers
const isMobile = () => (typeof window !== "undefined" ? window.innerWidth < 640 : true);
const haptics = (ms = 10) => { if (navigator?.vibrate) navigator.vibrate(ms); };

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
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false); // compat opcional
  const [message, setMessage] = useState("");

  // Sheet carrito móvil
  const [showCartSheet, setShowCartSheet] = useState(false);

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
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] as any;
          if (firstCat?.id) setActiveCat(firstCat.id);
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
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [menu]
  ) as Array<{ id: string; name: string }>;

  // Productos por categoría
  const productsByCategory = useMemo(() => {
    return categories.reduce((acc, cat) => {
      const products = Object.values(menu.products || {})
        .filter((p: any) => p && p.categoryId === cat.id && p.active !== false)
        .sort((a: any, b: any) => {
          const pa =
            typeof a.position === "number"
              ? a.position
              : typeof a.position === "string"
              ? parseInt(a.position)
              : Number.POSITIVE_INFINITY;
          const pb =
            typeof b.position === "number"
              ? b.position
              : typeof b.position === "string"
              ? parseInt(b.position)
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
    haptics();
  };

  const addToCart = (product: ProductT) => {
    // Normalizar el tipo del producto para manejar diferentes variaciones
    const productType = ((product as any).type || product.type || "").toLowerCase();
    const isVariedType = productType === "varied" || productType === "variado";
    const isPromotionType = productType === "promotion" || productType === "promocion" || productType === "promoción";
    const hasAddons = !!(product.addons && product.addons.length > 0);
    
    // Abrimos selector si es "varied", "promotion" o si tiene agregados
    if (isVariedType || isPromotionType || hasAddons) {
      handleVariedProduct(product);
      return;
    }
    
    // Agregar directamente al carrito para productos normales
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
    haptics();
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

  /** Mensaje de WA */
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

  /** Confirmar y abrir WhatsApp en la misma pestaña (evita bloqueos) */
  const confirmNow = async () => {
    if (cart.length === 0) {
      toast({ title: "Tu carrito está vacío", variant: "destructive" });
      return;
    }

    setPosting(true);
    setShowConfirm(false);

    const rawPhone =
      whatsappPhoneOverride ?? (settings?.whatsapp?.enabled ? settings?.whatsapp?.phone : "");
    const phoneDigits = normalizePhone(rawPhone || "");
    if (!phoneDigits) {
      setPosting(false);
      toast({
        title: "Teléfono de WhatsApp inválido",
        description: "Configura un número con código de país.",
        variant: "destructive",
      });
      return;
    }

    haptics(15);
    const url = buildWaUrl(phoneDigits, makeWaMessage());
    openWhatsAppNow(url); // Navega a WhatsApp

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
      toast({ title: "No se pudo guardar el pedido", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  // Compat si quieres usar animación antes de abrir WA (no recomendado por bloqueos)
  const confirmAndPlace = async () => {
    setShowConfirm(false);
    setShowLoadingAnimation(true);
  };
  const handleAnimationComplete = async () => {
    setShowLoadingAnimation(false);
    await confirmNow();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          {/* Skeletons de carga */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border bg-muted/30 h-44" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeList = activeCat ? productsByCategory[activeCat] || [] : [];

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

        {/* FAB Carrito (móvil) */}
        {isMobile() && cart.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCartSheet(true)}
            className="fixed bottom-20 right-4 z-30 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Carrito</span>
            <span className="ml-1 rounded-full bg-white/20 px-2 text-sm">{cart.length}</span>
          </motion.button>
        )}

        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="menu" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Menú de Almuerzos
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Mis Pagos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu">
            <div className="rounded-lg p-4 border bg-white">
              {/* Encabezado compacto */}
              <div className="bg-green-50 border border-green-200 p-3 rounded-md mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm">¡Hola, {clientName}!</div>
                  <div className="text-xs text-muted-foreground">Código: {clientId}</div>
                </div>
                {isPreview && <Badge variant="secondary">Vista previa</Badge>}
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
            {/* Productos */}
            <div className="lg:col-span-2">
              {categories.length > 0 && (
                <div className="mb-4 -mx-4 sm:mx-0">
                  <div
                    className="flex gap-2 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-none"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={activeCat === cat.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCat(cat.id)}
                        className="rounded-full snap-start px-3 py-2 text-sm"
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {activeCat && activeList.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeList.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition"
                    >
                      {/* imagen 16:9 */}
                      <div className="relative w-full aspect-video bg-muted/40">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sin imagen
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="text-[15px] font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">
                          {product.name}
                        </div>

                        {settings?.showPrices && typeof product.price === "number" && (
                          <div className="mt-1 text-sm font-semibold text-primary">
                            {PEN(product.price)}
                            {(() => {
                              const productType = ((product as any).type || product.type || "").toLowerCase();
                              const showPerDay = productType === "varied" || productType === "variado" || 
                                                productType === "promotion" || productType === "promocion" || productType === "promoción";
                              return showPerDay && <span className="ml-1 text-[11px] text-muted-foreground">/día</span>;
                            })()}
                          </div>
                        )}

                        {/* Agregados (chips acotados) */}
                        {!!(product.addons?.length) && (
                          <div className="mt-2 flex items-center gap-1 flex-wrap">
                            {product.addons.slice(0, 2).map((a, idx) => (
                              <Badge
                                key={`${a.id || idx}`}
                                variant="outline"
                                className="text-[11px] px-2 py-0.5 rounded-full"
                              >
                                {a.name} (+{PEN(Number(a.price) || 0)})
                              </Badge>
                            ))}
                            {product.addons.length > 2 && (
                              <span className="text-[11px] text-muted-foreground">
                                +{product.addons.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* FAB “+” circular */}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { haptics(); addToCart(product); }}
                        className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md grid place-items-center"
                        aria-label={`Agregar ${product.name}`}
                      >
                        <Plus className="h-5 w-5" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  {categories.length ? "No hay productos en esta categoría" : "No hay categorías configuradas"}
                </div>
              )}
            </div>

            {/* Carrito (panel desktop permanece) */}
            <div className="lg:col-span-1 hidden lg:block">
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
                      {/* Grupos por fecha (si aplica) */}
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

                        {/* Abrimos WA sin bloqueo */}
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
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsModule
              clientId={clientId}
              clientName={clientName}
              whatsappPhone={whatsappPhoneOverride ?? settings?.whatsapp?.phone}
            />
          </TabsContent>
        </Tabs>

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

        {/* Confirmación (si prefieres usar modal) */}
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

            <DialogFooter className="sticky bottom-0 bg-white pt-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmNow} disabled={posting} className="bg-green-600 hover:bg-green-700">
                {posting ? "Enviando pedido..." : "Enviar pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Animación opcional */}
        <OrderLoadingAnimation open={showLoadingAnimation} onComplete={handleAnimationComplete} />

        {/* Bottom Sheet Carrito (móvil) */}
        <Dialog open={showCartSheet} onOpenChange={setShowCartSheet}>
          <DialogContent className="sm:max-w-lg sm:rounded-lg rounded-t-2xl p-0 gap-0 translate-y-0 bottom-0 left-0 right-0 sm:left-auto sm:right-auto sm:bottom-auto">
            <div className="p-3 border-b text-center font-medium">Tu pedido</div>
            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2 text-xs">
              {cart.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Tu carrito está vacío</div>
              ) : (
                <>
                  {cart.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {PEN(it.price ?? 0)} × {it.quantity}
                          {!!it.selectedDays?.length && <> • {it.selectedDays.join(", ")}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeFromCart(it.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">{it.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => addToCart(it)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="p-3 border-t bg-primary/5">
              <div className="flex items-center justify-between font-semibold text-sm mb-2">
                <span>Total</span><span>{PEN(total)}</span>
              </div>
              <div className="flex items-center gap-2 text-green-800 text-xs mb-2">
                <MessageCircle className="h-4 w-4" />
                Se enviará confirmación por WhatsApp
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => { setShowCartSheet(false); confirmNow(); }}
                  disabled={!cart.length || posting}
                >
                  Confirmar
                </Button>
                <Button variant="outline" className="flex-1" onClick={clearCart}>
                  Limpiar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

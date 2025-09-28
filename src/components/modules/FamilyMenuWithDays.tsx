import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import FamilyOrderHistory from "@/components/modules/lunch/FamilyOrderHistory";
import { useActiveAnnouncements } from "@/hooks/useActiveAnnouncements";
import { AnnouncementBanner } from "@/components/ui/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import type { ProductT, CategoryT, MenuT, SettingsT as Settings, OrderItem } from "./lunch/types";
import { getNextWeekDays, getEnabledDays, isDatePast } from "./lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";


/* ===== Tipos ===== */
type Client = { code: string; name?: string };

type CartItem = ProductT & {
  qty: number;
  subtotal: number;
  selectedAddons?: any[];
  selectedDays?: string[]; // Para productos variados
};

type Props = {
  client: Client;
  onLogout?: () => void;
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n ?? 0);

function inWindow(win?: { start?: string; end?: string }) {
  if (!win?.start || !win?.end) return true;
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return hhmm >= win.start && hhmm <= win.end;
}

function cmpByPositionThenName(a: ProductT, b: ProductT) {
  const toNum = (v: unknown): number =>
    isFinite(Number(v)) ? Number(v) : Number.POSITIVE_INFINITY;
  const pa = toNum(a.position ?? a.order);
  const pb = toNum(b.position ?? b.order);
  if (pa !== pb) return pa - pb;
  return (a.name || "").localeCompare(b.name || "");
}

export default function FamilyMenuWithDays({ client, onLogout }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuT | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [resolvedName, setResolvedName] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // Hook para obtener anuncios activos
  const { announcements } = useActiveAnnouncements();

  // Modal de confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState<string>("");
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("segundo");
  const [confirmNote, setConfirmNote] = useState<string>("");

  // Modal de selección de días para productos variados
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  /* ==== Resolver nombre ==== */
  useEffect(() => {
    let mounted = true;
    async function tryGet(path: string) {
      try {
        const snap = await RTDBHelper.getData<any>(path);
        return snap && typeof snap === "object" ? snap : null;
      } catch {
        return null;
      }
    }
    (async () => {
      if (client.name && client.name.trim()) {
        if (mounted) setResolvedName(client.name.trim());
        return;
      }
      const candidates: string[] = [];
      if ((RTDB_PATHS as any)?.clients) {
        candidates.push(`${(RTDB_PATHS as any).clients}/${client.code}`);
      }
      candidates.push(`/clients/${client.code}`, `/students/${client.code}`, `/alumnos/${client.code}`, `/people/${client.code}`);
      for (const p of candidates) {
        const row = await tryGet(p);
        const name = row?.name || row?.fullName || row?.fullname;
        if (mounted && name) {
          setResolvedName(String(name));
          return;
        }
        if (row?.names || row?.lastNames) {
          const n = (row.names || "").toString().trim();
          const ln = (row.lastNames || "").toString().trim();
          const composed = `${n}${n && ln ? " " : ""}${ln}`.trim();
          if (mounted && composed) {
            setResolvedName(composed);
            return;
          }
        }
      }
      const idx = await tryGet(`clients_by_code/${client.code}`);
      if (mounted && idx?.name) {
        setResolvedName(String(idx.name));
        return;
      }
      if (mounted) setResolvedName("Estudiante");
    })();
    return () => { mounted = false; };
  }, [client.code, client.name]);

  /* ==== Escuchar configuración y menú ==== */
  useEffect(() => {
    const off1 = RTDBHelper.listenToData<Settings>(RTDB_PATHS.lunch_settings, (d) => setSettings(d || null));
    const off2 = RTDBHelper.listenToData<MenuT>(RTDB_PATHS.lunch_menu, (d) => setMenu(d || null));
    return () => { off1?.(); off2?.(); };
  }, []);

  /* ==== Derivados ==== */
  const categories = useMemo<CategoryT[]>(() => {
    const m = menu?.categories || {};
    return Object.values(m).filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const productsByCategory = useMemo<Record<string, ProductT[]>>(() => {
    const out: Record<string, ProductT[]> = {};
    const all = Object.values(menu?.products || {}).filter((p) => {
      if (!p || p.active === false) return false;
      // Ocultar almuerzos en el pasado
      if (p.type === "lunch" && p.specificDate && isDatePast(p.specificDate)) {
        return false;
      }
      return true;
    });

    for (const p of all) {
      const key = p.categoryId || "otros";
      (out[key] ||= []).push(p as ProductT);
    }
    for (const key of Object.keys(out)) out[key].sort(cmpByPositionThenName);
    return out;
  }, [menu]);

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  // Obtener días disponibles basados en configuración
  const availableDays = useMemo(() => {
    const enabledDayNames = getEnabledDays(settings?.disabledDays);
    const weekDays = getNextWeekDays();
    return weekDays.filter(day => enabledDayNames.includes(day.day));
  }, [settings]);

  const total = useMemo(() => {
    return Object.values(cart).reduce((acc, item) => {
      if (item.type === "varied" && item.selectedDays) {
        return acc + (item.price * item.qty * item.selectedDays.length);
      }
      return acc + (item.subtotal || 0);
    }, 0);
  }, [cart]);

  /* ==== Manejar productos variados ==== */
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setShowDaySelection(true);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) {
      setMessage("Debe seleccionar al menos un día.");
      return;
    }

    const cartKey = `${selectedProduct.id}_varied`;
    setCart((prev) => {
      const existing = prev[cartKey];
      const newQty = (existing?.qty ?? 0) + 1;

      return {
        ...prev,
        [cartKey]: {
          ...selectedProduct,
          qty: newQty,
          subtotal: selectedProduct.price * newQty * selectedDays.length,
          selectedDays: selectedDays.slice(),
        },
      };
    });

    setShowDaySelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
  };

  /* ==== Agregar productos de almuerzo ==== */
  const addLunchToCart = (product: ProductT) => {
    if (!product.specificDate) return;

    setCart((prev) => {
      const existing = prev[product.id];
      const newQty = (existing?.qty ?? 0) + 1;

      return {
        ...prev,
        [product.id]: {
          ...product,
          qty: newQty,
          subtotal: product.price * newQty,
        },
      };
    });
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;

      const newQty = existing.qty - 1;
      if (newQty <= 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }

      const newSubtotal =
        existing.type === "varied" && existing.selectedDays
          ? existing.price * newQty * existing.selectedDays.length
          : existing.price * newQty;

      return {
        ...prev,
        [key]: {
          ...existing,
          qty: newQty,
          subtotal: newSubtotal,
        },
      };
    });
  };

  const clearCart = () => setCart({});

  /* ===== Confirmar pedido ===== */
  const openConfirm = () => {
    setMessage(null);
    if (settings?.isOpen === false) { setMessage("El pedido no está disponible en este momento."); return; }
    if (!inWindow(settings?.orderWindow)) { setMessage("Fuera del horario permitido para pedidos."); return; }
    if (!Object.keys(cart).length) { setMessage("Agregue al menos un producto."); return; }
    setConfirmStudent(resolvedName || client.name || "Estudiante");
    setConfirmRecess("segundo");
    setConfirmNote("");
    setShowConfirm(true);
  };

  const confirmAndPlace = async () => {
    setMessage(null);
    const alumno = (confirmStudent || "").trim();
    if (!alumno) { setMessage("Debe indicar el nombre del alumno."); return; }

    setPosting(true);
    try {
      const orderCode = await RTDBHelper.getNextCorrelative("lunch");
      const items: OrderItem[] = Object.values(cart).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        ...(item.type === "lunch" ? { specificDate: item.specificDate } : {}),
        ...(item.type === "varied" ? { selectedDays: item.selectedDays } : {}),
      }));

      const payload = {
        id: "",
        code: orderCode,
        clientCode: client.code,
        clientName: resolvedName || client.name || "Estudiante",
        items,
        note: confirmNote || null,
        total,
        status: "pending",
        createdAt: Date.now(),
        channel: "familias",
        recess: confirmRecess,
        studentName: alumno,
      };

      const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, payload);
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${orderId}/id`]: orderId,
        [`lunch_orders_by_client/${client.code}/${orderId}`]: true,
      });

      clearCart();
      setShowConfirm(false);
      setMessage(`¡Pedido enviado! N° ${orderCode}`);
    } catch (err) {
      console.error("Error pushing order:", err);
      setMessage("No se pudo enviar el pedido. Intente nuevamente.");
    } finally {
      setPosting(false);
    }
  };

  /* ===== Tarjeta de producto ===== */
  const ProductCard: React.FC<{ p: ProductT }> = ({ p }) => {
    const handleAddToCart = () => {
      if (p.type === "varied") {
        handleVariedProduct(p);
      } else {
        addLunchToCart(p);
      }
    };

    return (
      <Card key={p.id} className="h-full">
        {p.image && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img
              src={p.image}
              alt={p.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">{p.name}</h3>
            {p.description && (
              <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-lg">{PEN(p.price)}</span>
              {p.type === "varied" && (
                <p className="text-xs text-muted-foreground">por día</p>
              )}
              {p.type === "lunch" && p.specificDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(p.specificDate + "T12:00:00").toLocaleDateString("es-PE", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}

              {/* Detalle de almuerzo debajo del precio */}
              {p.type === "lunch" && (
                <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
                  {(p as any).entrada && (
                    <li>🥗 <span className="font-medium">Entrada:</span> {(p as any).entrada}</li>
                  )}
                  {(p as any).segundo && (
                    <li>🍽️ <span className="font-medium">Segundo:</span> {(p as any).segundo}</li>
                  )}
                  {(p as any).postre && (
                    <li>🍰 <span className="font-medium">Postre:</span> {(p as any).postre}</li>
                  )}
                  {(p as any).refresco && (
                    <li>🥤 <span className="font-medium">Refresco:</span> {(p as any).refresco}</li>
                  )}
                  {p.description && (
                    <li>📝 <span className="font-medium">Observación:</span> {p.description}</li>
                  )}
                </ul>
              )}
            </div>

            <Button onClick={handleAddToCart} size="sm">
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">¡Hola, {resolvedName}!</h1>
              <p className="text-sm text-muted-foreground">Código: {client.code}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? "Ocultar historial" : "Ver historial"}
              </Button>
              {onLogout && (
                <Button variant="outline" onClick={onLogout}>
                  Salir
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Anuncios */}
        {announcements.length > 0 && (
          <div className="mb-6">
            <AnnouncementBanner announcements={announcements} />
          </div>
        )}

        {/* Historial */}
        {showHistory && (
          <div className="mb-6">
            <FamilyOrderHistory clientCode={client.code} />
          </div>
        )}

        {/* Mensaje */}
        {message && (
          <div className="mb-6">
            <Card className={message.includes("Error") || message.includes("No se") ? "border-destructive" : "border-green-500"}>
              <CardContent className="p-4">
                <p className={message.includes("Error") || message.includes("No se") ? "text-destructive" : "text-green-700"}>
                  {message}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Menú */}
          <div className="lg:col-span-3">
            {/* Categorías */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCat === cat.id ? "default" : "outline"}
                  onClick={() => setActiveCat(cat.id)}
                  className="whitespace-nowrap"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Productos */}
            {activeCat && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(productsByCategory[activeCat] || []).map((product) => (
                  <ProductCard key={product.id} p={product} />
                ))}
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Tu pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(cart).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Tu carrito está vacío
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {Object.entries(cart).map(([key, item]) => (
                        <div key={key} className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.qty} × {PEN(item.price)}
                              {item.type === "varied" && item.selectedDays && (
                                <span> × {item.selectedDays.length} días</span>
                              )}
                            </p>
                            {item.selectedDays && (
                              <p className="text-xs text-muted-foreground">
                                Días: {item.selectedDays.map(date =>
                                  new Date(date + "T12:00:00").toLocaleDateString("es-PE", {
                                    weekday: "short",
                                    day: "numeric",
                                  })
                                ).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{PEN(item.subtotal)}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeFromCart(key)}
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center font-bold">
                        <span>Total:</span>
                        <span>{PEN(total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        onClick={openConfirm}
                        disabled={posting}
                      >
                        {posting ? "Enviando..." : "Confirmar pedido"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={clearCart}
                      >
                        Limpiar carrito
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de selección de días */}
      <SelectDaysDialog
  open={showDaySelection}
  onOpenChange={setShowDaySelection}
  productName={selectedProduct?.name}
  pricePerDay={selectedProduct?.price}
  // Tus availableDays ya son objetos { date, label, day }
  days={availableDays.map(d => ({ date: d.date, label: d.label }))}
  selectedDays={selectedDays}
  onToggleDay={(date, checked) =>
    setSelectedDays((prev) => (checked ? [...prev, date] : prev.filter((d) => d !== date)))
  }
  onConfirm={addVariedToCart}
  confirmDisabled={selectedDays.length === 0}
/>


      {/* Modal de confirmación */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="studentName">Nombre del estudiante</Label>
              <Input
                id="studentName"
                value={confirmStudent}
                onChange={(e) => setConfirmStudent(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="recess">Recreo</Label>
              <Select value={confirmRecess} onValueChange={(value: "primero" | "segundo") => setConfirmRecess(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primero">Primer recreo</SelectItem>
                  <SelectItem value="segundo">Segundo recreo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note">Observaciones (opcional)</Label>
              <Textarea
                id="note"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="Alguna observación especial..."
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center font-bold">
                <span>Total:</span>
                <span>{PEN(total)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmAndPlace}
                disabled={posting}
              >
                {posting ? "Enviando..." : "Confirmar pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

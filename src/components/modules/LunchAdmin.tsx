import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { useSession } from "@/state/session";
import { toast } from "@/components/ui/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  Package,
  Settings,
  FileText,
  Save,
  Trash2,
  Edit,
  ArrowLeft,
  CheckCircle,
  Clock,
} from "lucide-react";

import type {
  SettingsT,
  CategoryT,
  MenuT,
  OrderT,
} from "@/components/modules/lunch/types";

import ProductsPanel from "@/components/modules/lunch/products/ProductsPanel";

interface Props {
  onBack?: () => void;
}

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function LunchAdmin({ onBack }: Props = {}) {
  const { user } = useSession();

  const [settings, setSettings] = useState<SettingsT>({
    isOpen: true,
    showPrices: true,
    cutoffTime: "11:00",
    allowSameDay: true,
    orderWindow: { start: "", end: "" },
  });

  const [menu, setMenu] = useState<MenuT>({});
  const [ordersToday, setOrdersToday] = useState<OrderT[]>([]);
  const [tab, setTab] = useState<"settings" | "cats" | "products" | "orders">("settings");
  const [loading, setLoading] = useState(false);

  // ---------- Estado Categorías ----------
  const [catName, setCatName] = useState("");
  const [catEditing, setCatEditing] = useState<CategoryT | null>(null);

  // ---------- Carga inicial ----------
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const loadAll = async () => {
      try {
        const s = await RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings);
        if (s) {
          setSettings({
            isOpen: s.isOpen ?? true,
            showPrices: s.showPrices ?? true,
            cutoffTime: s.cutoffTime || "11:00",
            allowSameDay: s.allowSameDay ?? true,
            orderWindow: s.orderWindow || { start: "", end: "" },
          });
        }
        const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
        if (m) setMenu(m);

        const allOrders = await RTDBHelper.getData<Record<string, OrderT>>(
          RTDB_PATHS.lunch_orders
        );
        if (allOrders) {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const end = start + 24 * 60 * 60 * 1000 - 1;

          setOrdersToday(
            Object.values(allOrders).filter((o) => {
              const t = typeof o.createdAt === "number" ? o.createdAt : Date.parse(String(o.createdAt || 0));
              return t >= start && t <= end;
            })
          );
        }
      } catch {
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos.",
          variant: "destructive",
        });
      }
    };

    loadAll();
  }, [user]);

  // ---------- Derivados ----------
  const categories = useMemo(() => {
    const c = menu.categories || {};
    return Object.values(c).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  // ================== Acciones: Configuración ==================
  const saveSettings = async () => {
    setLoading(true);
    try {
      await RTDBHelper.setData(RTDB_PATHS.lunch_settings, settings);
      toast({ title: "Configuración guardada" });
    } catch {
      toast({ title: "No se pudo guardar la configuración", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ================== Acciones: Categorías ==================
  const resetCatForm = () => {
    setCatName("");
    setCatEditing(null);
  };

  const saveCategory = async () => {
    const name = catName.trim();
    if (!name) {
      toast({ title: "Escribe un nombre de categoría", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (catEditing) {
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/categories/${catEditing.id}/name`]: name,
        });
        toast({ title: "Categoría actualizada" });
      } else {
        const id = slugId(name);
        const order = (categories[categories.length - 1]?.order ?? 0) + 1;
        await RTDBHelper.setData(`${RTDB_PATHS.lunch_menu}/categories/${id}`, {
          id,
          name,
          order,
        });
        toast({ title: "Categoría creada" });
      }
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) setMenu(m);
      resetCatForm();
    } catch {
      toast({ title: "No se pudo guardar la categoría", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const editCategory = (c: CategoryT) => {
    setCatEditing(c);
    setCatName(c.name);
  };

  const deleteCategory = async (c: CategoryT) => {
    if (!confirm(`Eliminar categoría "${c.name}"?`)) return;
    setLoading(true);
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.lunch_menu}/categories/${c.id}`);
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) setMenu(m);
      toast({ title: "Categoría eliminada" });
    } catch {
      toast({ title: "No se pudo eliminar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const moveCategory = async (c: CategoryT, dir: -1 | 1) => {
    const arr = categories;
    const i = arr.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const A = arr[i];
    const B = arr[j];
    await RTDBHelper.updateData({
      [`${RTDB_PATHS.lunch_menu}/categories/${A.id}/order`]: B.order ?? 0,
      [`${RTDB_PATHS.lunch_menu}/categories/${B.id}/order`]: A.order ?? 0,
    });
    const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
    if (m) setMenu(m);
  };

  // ================== Pedidos ==================
  const markDelivered = async (o: OrderT) => {
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${o.id}/status`]: "delivered",
        [`${RTDB_PATHS.lunch_orders}/${o.id}/deliveryAt`]: new Date().toISOString(),
      });
      const allOrders = await RTDBHelper.getData<Record<string, OrderT>>(
        RTDB_PATHS.lunch_orders
      );
      if (allOrders) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const end = start + 24 * 60 * 60 * 1000 - 1;

        setOrdersToday(
          Object.values(allOrders).filter((x) => {
            const t = typeof x.createdAt === "number" ? x.createdAt : Date.parse(String(x.createdAt || 0));
            return t >= start && t <= end;
          })
        );
      }
      toast({ title: "Pedido marcado como entregado" });
    } catch {
      toast({ title: "No se pudo actualizar el pedido", variant: "destructive" });
    }
  };

  const printOrders = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
      <html><head><title>Pedidos del día</title>
      <style>
        body{font-family:Arial, sans-serif; margin:16px}
        .h{ text-align:center; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:16px;}
        .o{ border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:10px}
        .row{display:flex; justify-content:space-between; align-items:center}
        .s{font-size:12px; padding:2px 8px; border-radius:12px; background:#eee}
        .it{margin-left:12px}
      </style></head><body>
      <div class="h">
        <h2>COMANDA DE ALMUERZOS</h2>
        <div>${new Date().toLocaleString("es-PE")}</div>
      </div>
      ${ordersToday
        .map(
          (o) => `
        <div class="o">
          <div class="row">
            <div><strong>${o.clientName}</strong> — <em>${o.code}</em></div>
            <div class="s">${o.status}</div>
          </div>
          <div><em>Productos:</em>${
            o.items?.map((i) => `<div class="it">• ${i.qty} x ${i.name}</div>`).join("") || ""
          }</div>
          ${o.note ? `<div><em>Obs:</em> ${o.note}</div>` : ""}
          ${o.studentName ? `<div><em>Alumno:</em> ${o.studentName}</div>` : ""}
          ${o.recess ? `<div><em>Recreo:</em> ${o.recess}</div>` : ""}
          <div style="text-align:right"><strong>Total:</strong> ${PEN(o.total)}</div>
        </div>`
        )
        .join("")}
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  // ---------- Guard de admin ----------
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Acceso denegado</CardTitle>
          </CardHeader>
          <CardContent>Solo administradores pueden acceder a este módulo.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button
                  variant="ghost"
                  onClick={onBack}
                  className="flex items-center gap-2 px-2"
                  title="Volver al dashboard"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Volver</span>
                </Button>
              )}
              <CardTitle className="text-2xl font-bold">Administración de Almuerzos</CardTitle>
            </div>
            <p className="text-muted-foreground hidden sm:block">
              Configura el portal, categorías y productos.
            </p>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuración
            </TabsTrigger>
            <TabsTrigger value="cats" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Categorías
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Productos
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pedidos del día ({ordersToday.length})
            </TabsTrigger>
          </TabsList>

          {/* ================= Configuración ================= */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del portal de familias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.isOpen ?? false}
                      onCheckedChange={(v) => setSettings({ ...settings, isOpen: v })}
                    />
                    <Label>Portal abierto</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.showPrices ?? true}
                      onCheckedChange={(v) => setSettings({ ...settings, showPrices: v })}
                    />
                    <Label>Mostrar precios a familias</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Hora límite</Label>
                      <Input
                        type="time"
                        value={settings.cutoffTime || "11:00"}
                        onChange={(e) =>
                          setSettings({ ...settings, cutoffTime: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Permitir mismo día</Label>
                      <div className="flex items-center gap-2 h-9">
                        <Switch
                          checked={settings.allowSameDay ?? true}
                          onCheckedChange={(v) =>
                            setSettings({ ...settings, allowSameDay: v })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Ventana desde</Label>
                    <Input
                      type="time"
                      value={settings.orderWindow?.start || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          orderWindow: { ...settings.orderWindow, start: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Ventana hasta</Label>
                    <Input
                      type="time"
                      value={settings.orderWindow?.end || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          orderWindow: { ...settings.orderWindow, end: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Categorías ================= */}
          <TabsContent value="cats">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{catEditing ? "Editar categoría" : "Nueva categoría"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Ej. Almuerzos"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveCategory} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {catEditing ? "Guardar cambios" : "Crear"}
                    </Button>
                    {catEditing && (
                      <Button variant="outline" onClick={resetCatForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Categorías</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categories.length === 0 && (
                    <p className="text-muted-foreground">No hay categorías.</p>
                  )}
                  {categories.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between border rounded p-2"
                    >
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Orden: {c.order ?? 0}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => moveCategory(c, -1)}
                          disabled={i === 0}
                          title="Subir"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => moveCategory(c, +1)}
                          disabled={i === categories.length - 1}
                          title="Bajar"
                        >
                          ↓
                        </Button>
                        <Button variant="outline" onClick={() => editCategory(c)} title="Editar">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => deleteCategory(c)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================= Productos ================= */}
          <TabsContent value="products">
            <ProductsPanel menu={menu} onMenuChange={setMenu} />
          </TabsContent>

          {/* ================= Pedidos del día ================= */}
          <TabsContent value="orders">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Pedidos del día — {new Date().toLocaleDateString("es-PE")}</CardTitle>
                <Button variant="outline" onClick={printOrders}>
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir comanda
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {ordersToday.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No hay pedidos registrados hoy.
                  </p>
                )}
                {ordersToday.map((o) => (
                  <Card key={o.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-lg">{o.clientName}</div>
                          <div className="text-xs text-muted-foreground">Código: {o.code}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              o.status === "delivered"
                                ? "default"
                                : o.status === "preparing" || o.status === "ready"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {o.status}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(
                              typeof o.createdAt === "number" ? o.createdAt : Date.parse(String(o.createdAt))
                            ).toLocaleTimeString("es-PE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium">Productos:</div>
                        {o.items?.map((i, k) => (
                          <div key={k} className="ml-4 text-muted-foreground">
                            • {i.qty} x {i.name}
                          </div>
                        ))}
                      </div>

                      {o.studentName && (
                        <div className="text-sm">
                          <div className="font-medium">Alumno:</div>
                          <div className="ml-4 text-muted-foreground">{o.studentName}</div>
                        </div>
                      )}

                      {o.recess && (
                        <div className="text-sm">
                          <div className="font-medium">Recreo:</div>
                          <div className="ml-4 text-muted-foreground">{o.recess}</div>
                        </div>
                      )}

                      {o.note && (
                        <div className="text-sm">
                          <div className="font-medium">Observaciones:</div>
                          <div className="ml-4 text-muted-foreground">{o.note}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="font-bold">Total: {PEN(o.total)}</div>
                        {o.status !== "delivered" && o.status !== "canceled" && (
                          <Button size="sm" onClick={() => markDelivered(o)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar entregado
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------- util local ---------- */
function slugId(label: string) {
  const s = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${s || "id"}-${Math.random().toString(36).slice(2, 6)}`;
}

// src/components/modules/LunchAdmin.tsx
import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { useSession } from "@/state/session";
import { toast } from "@/components/ui/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

/* ================== Tipos ================== */
type SettingsT = {
  isOpen?: boolean;
  showPrices?: boolean;       // 👈 usado por familias
  cutoffTime?: string;        // 👈 usado por familias (ej: "11:00")
  allowSameDay?: boolean;
  orderWindow?: { start?: string; end?: string };
};

type CategoryT = { id: string; name: string; order?: number };
type ProductT = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  description?: string;
  image?: string;
  active?: boolean;
};

type MenuT = {
  categories?: Record<string, CategoryT>;
  products?: Record<string, ProductT>;
};

type OrderT = {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  items: Array<{ id: string; name: string; price: number; qty: number }>;
  note?: string;
  total: number;
  status: "pending" | "preparing" | "delivered" | "canceled" | "confirmed" | "ready";
  createdAt: string;
  deliveryAt?: string;
};

/* ================== Utils ================== */
const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

function slugId(label: string) {
  const s = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${s || "id"}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ================== Componente ================== */
interface Props {
  onBack?: () => void;
}
export default function LunchAdmin({ onBack }: Props = {}) {
  const { user } = useSession();

  /* ---------- Estado ---------- */
  const [settings, setSettings] = useState<SettingsT>({
    isOpen: true,
    showPrices: true,
    cutoffTime: "11:00",
    allowSameDay: true,
    orderWindow: { start: "", end: "" },
  });
  const [menu, setMenu] = useState<MenuT>({});
  const [ordersToday, setOrdersToday] = useState<OrderT[]>([]);

  // Categorías
  const [catName, setCatName] = useState("");
  const [catEditing, setCatEditing] = useState<CategoryT | null>(null);

  // Productos
  const [prodEditing, setProdEditing] = useState<ProductT | null>(null);
  const [prodForm, setProdForm] = useState<Partial<ProductT>>({ active: true });

  // Importación rápida
  const [bulk, setBulk] = useState("");

  const [tab, setTab] = useState<"settings" | "cats" | "products" | "orders">("settings");
  const [loading, setLoading] = useState(false);

  /* ---------- Cargar datos ---------- */
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const loadAll = async () => {
      try {
        const s = await RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings);
        if (s) setSettings({
          isOpen: s.isOpen ?? true,
          showPrices: s.showPrices ?? true,
          cutoffTime: s.cutoffTime || "11:00",
          allowSameDay: s.allowSameDay ?? true,
          orderWindow: s.orderWindow || { start: "", end: "" },
        });

        const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
        if (m) setMenu(m);

        const allOrders = await RTDBHelper.getData<Record<string, OrderT>>(RTDB_PATHS.lunch_orders);
        if (allOrders) {
          const today = new Date().toISOString().slice(0, 10);
          setOrdersToday(
            Object.values(allOrders).filter((o) => (o.createdAt || "").startsWith(today))
          );
        }
      } catch {
        toast({ title: "Error", description: "No se pudieron cargar datos", variant: "destructive" });
      }
    };
    loadAll();
  }, [user]);

  /* ---------- Derivados ---------- */
  const categories = useMemo(() => {
    const c = menu.categories || {};
    return Object.values(c).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const products = useMemo(() => {
    const p = menu.products || {};
    return Object.values(p).sort((a, b) => a.name.localeCompare(b.name));
  }, [menu]);

  /* ================== Acciones: Configuración ================== */
  const saveSettings = async () => {
    setLoading(true);
    try {
      await RTDBHelper.setData(RTDB_PATHS.lunch_settings, settings);
      toast({ title: "Configuración guardada" });
    } catch {
      toast({ title: "No se pudo guardar configuración", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ================== Acciones: Categorías ================== */
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
        await RTDBHelper.setData(`${RTDB_PATHS.lunch_menu}/categories/${id}`, { id, name, order });
        toast({ title: "Categoría creada" });
      }
      // reload
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
      // Nota: los productos quedan con categoryId huérfano; podrás cambiarlos luego.
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

  /* ================== Acciones: Productos ================== */
  const resetProdForm = () => {
    setProdEditing(null);
    setProdForm({ active: true });
  };

  const editProduct = (p: ProductT) => {
    setProdEditing(p);
    setProdForm(p);
  };

  const saveProduct = async () => {
    const name = (prodForm.name || "").trim();
    const price = Number(prodForm.price);
    const categoryId = (prodForm.categoryId || "").trim();
    if (!name) return toast({ title: "El producto necesita nombre", variant: "destructive" });
    if (!isFinite(price) || price < 0)
      return toast({ title: "Precio inválido", variant: "destructive" });
    if (!categoryId || !menu.categories?.[categoryId])
      return toast({ title: "Elige una categoría válida", variant: "destructive" });

    const payload: ProductT = {
      id: prodEditing?.id || "",
      name,
      price,
      categoryId,
      description: prodForm.description?.trim(),
      image: prodForm.image?.trim(),
      active: prodForm.active !== false,
    };

    setLoading(true);
    try {
      if (prodEditing) {
        const updates: Record<string, any> = {};
        for (const [k, v] of Object.entries(payload)) {
          if (k === "id") continue;
          updates[`${RTDB_PATHS.lunch_menu}/products/${prodEditing.id}/${k}`] = v;
        }
        await RTDBHelper.updateData(updates);
        toast({ title: "Producto actualizado" });
      } else {
        const newId = await RTDBHelper.pushData(`${RTDB_PATHS.lunch_menu}/products`, {
          ...payload,
          active: true,
        });
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${newId}/id`]: newId,
        });
        toast({ title: "Producto creado" });
      }
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) setMenu(m);
      resetProdForm();
    } catch {
      toast({ title: "No se pudo guardar el producto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (p: ProductT) => {
    if (!confirm(`Eliminar producto "${p.name}"?`)) return;
    setLoading(true);
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.lunch_menu}/products/${p.id}`);
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) setMenu(m);
      toast({ title: "Producto eliminado" });
    } catch {
      toast({ title: "No se pudo eliminar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (p: ProductT) => {
    await RTDBHelper.updateData({
      [`${RTDB_PATHS.lunch_menu}/products/${p.id}/active`]: !(p.active !== false),
    });
    const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
    if (m) setMenu(m);
  };

  const bulkImport = async () => {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return toast({ title: "Pega al menos una línea", variant: "destructive" });

    const updates: Record<string, any> = {};
    for (const line of lines) {
      const [nRaw, pRaw, cRaw] = line.split(/[;,]\s*/);
      const name = (nRaw || "").trim();
      const price = Number(pRaw);
      const catName = (cRaw || "").trim();
      if (!name || !isFinite(price)) continue;
      const cat =
        categories.find((c) => c.name.toLowerCase() === catName.toLowerCase()) || categories[0];
      if (!cat) continue;
      const id = (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2);
      updates[`${RTDB_PATHS.lunch_menu}/products/${id}`] = {
        id,
        name,
        price,
        categoryId: cat.id,
        active: true,
      };
    }
    try {
      await RTDBHelper.updateData(updates);
      const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (m) setMenu(m);
      setBulk("");
      toast({ title: "Productos importados" });
    } catch {
      toast({ title: "No se pudo importar", variant: "destructive" });
    }
  };

  /* ================== Pedidos ================== */
  const markDelivered = async (o: OrderT) => {
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${o.id}/status`]: "delivered",
        [`${RTDB_PATHS.lunch_orders}/${o.id}/deliveryAt`]: new Date().toISOString(),
      });
      const allOrders = await RTDBHelper.getData<Record<string, OrderT>>(RTDB_PATHS.lunch_orders);
      if (allOrders) {
        const today = new Date().toISOString().slice(0, 10);
        setOrdersToday(Object.values(allOrders).filter((x) => (x.createdAt || "").startsWith(today)));
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
            <div><strong>${o.clientName}</strong> (${o.code})</div>
            <div class="s">${o.status}</div>
          </div>
          <div><em>Productos:</em>${
            o.items?.map((i) => `<div class="it">• ${i.qty} x ${i.name}</div>`).join("") || ""
          }</div>
          ${o.note ? `<div><em>Obs:</em> ${o.note}</div>` : ""}
          <div style="text-align:right"><strong>Total:</strong> ${PEN(o.total)}</div>
        </div>`
        )
        .join("")}
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  /* ================== Guard Admin ================== */
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

  /* ================== UI ================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Administración de Almuerzos</CardTitle>
              <p className="text-muted-foreground">Configura el portal, categorías y productos.</p>
            </div>
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            )}
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
                        onChange={(e) => setSettings({ ...settings, cutoffTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Permitir mismo día</Label>
                      <div className="flex items-center gap-2 h-9">
                        <Switch
                          checked={settings.allowSameDay ?? true}
                          onCheckedChange={(v) => setSettings({ ...settings, allowSameDay: v })}
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
                    <div key={c.id} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">Orden: {c.order ?? 0}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => moveCategory(c, -1)} disabled={i === 0}>
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => moveCategory(c, +1)}
                          disabled={i === categories.length - 1}
                        >
                          ↓
                        </Button>
                        <Button variant="outline" onClick={() => editCategory(c)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="destructive" onClick={() => deleteCategory(c)}>
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
            <div className="grid xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-1">
                <CardHeader>
                  <CardTitle>{prodEditing ? "Editar producto" : "Nuevo producto"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={prodForm.name || ""}
                      onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                      placeholder="Arroz con pollo"
                    />
                  </div>
                  <div>
                    <Label>Precio (PEN)</Label>
                    <Input
                      inputMode="decimal"
                      value={prodForm.price ?? ""}
                      onChange={(e) =>
                        setProdForm({ ...prodForm, price: Number(e.target.value.replace(",", ".")) })
                      }
                      placeholder="8.50"
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <select
                      className="border rounded h-9 px-2 w-full"
                      value={prodForm.categoryId || ""}
                      onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                    >
                      <option value="">Seleccione…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Descripción (opcional)</Label>
                    <Textarea
                      value={prodForm.description || ""}
                      onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Imagen (URL pública opcional)</Label>
                    <Input
                      value={prodForm.image || ""}
                      onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prodForm.active !== false}
                      onCheckedChange={(v) => setProdForm({ ...prodForm, active: v })}
                    />
                    <Label>Activo</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveProduct} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {prodEditing ? "Guardar cambios" : "Crear producto"}
                    </Button>
                    {prodEditing && (
                      <Button variant="outline" onClick={resetProdForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Productos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {products.length === 0 && (
                    <p className="text-muted-foreground">No hay productos.</p>
                  )}
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 gap-2 items-center border rounded p-2"
                    >
                      <div className="col-span-5">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {menu.categories?.[p.categoryId]?.name || "—"}
                        </div>
                      </div>
                      <div className="col-span-2">{PEN(p.price)}</div>
                      <div className="col-span-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            p.active !== false
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.active !== false ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="col-span-3 flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => toggleActive(p)}>
                          {p.active !== false ? "Desactivar" : "Activar"}
                        </Button>
                        <Button variant="outline" onClick={() => editProduct(p)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="destructive" onClick={() => deleteProduct(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="xl:col-span-3">
                <CardHeader>
                  <CardTitle>Importar rápido (pegar)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Formato por línea: <code>nombre;precio;categoría</code> — ej:
                    <code> Arroz con pollo;8.5;Almuerzos</code>
                  </p>
                  <Textarea
                    value={bulk}
                    onChange={(e) => setBulk(e.target.value)}
                    className="h-32 font-mono"
                    placeholder={`Arroz con pollo;8.5;Almuerzos\nJugo natural;3;Bebidas`}
                  />
                  <Button onClick={bulkImport} disabled={!bulk.trim()}>
                    Importar productos
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                            {new Date(o.createdAt).toLocaleTimeString("es-PE", {
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

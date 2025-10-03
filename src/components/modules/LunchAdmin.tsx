// src/components/modules/lunch/LunchAdmin.tsx
import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { useSession } from "@/state/session";
import { toast } from "@/components/ui/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Package, Settings, Save, Trash2, Edit, ArrowLeft, FileText, Megaphone, Eye } from "lucide-react";

import type { SettingsT, CategoryT, MenuT, OrderT, AnnouncementT } from "@/components/modules/lunch/types";
import { useImageUpload } from "@/hooks/useImageUpload";
import { format } from "date-fns";

import ProductsPanel from "@/components/modules/lunch/products/ProductsPanel";
import OrdersByDayView from "@/components/modules/lunch/history/OrdersByDayView";
import FamilyPortalPreview from "@/components/modules/lunch/FamilyPortalPreview";

/* ===================== util ===================== */
type LunchAdminProps = { onBack?: () => void };

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

/** Normaliza un teléfono para WhatsApp (solo dígitos) */
function normalizePhone(raw?: string): string {
  return (raw || "").replace(/\D+/g, "");
}

/* ============================================================
   FIX TIPOS: extendemos SettingsT localmente para permitir
   version/updateSeq/updatedAt/forceMajor/whatsapp
   ============================================================ */
type AdminSettings = SettingsT & {
  version?: string;
  updateSeq?: number;
  updatedAt?: number;
  forceMajor?: boolean;
  enabledDays?: Record<string, boolean>;
  disabledDays?: Record<string, boolean>;
};

export default function LunchAdmin({ onBack }: LunchAdminProps = {}) {
  const { user } = useSession();

  // Estado principal
  const [settings, setSettings] = useState<AdminSettings>({
    isOpen: true,
    showPrices: true,
    cutoffTime: "11:00",
    allowSameDay: true,
    orderWindow: { start: "", end: "" },
    whatsapp: { enabled: false, phone: "" },
  });

  const [menu, setMenu] = useState<MenuT>({});
  const [ordersCount, setOrdersCount] = useState<number>(0); // para mostrar en la pestaña
  const [announcements, setAnnouncements] = useState<AnnouncementT[]>([]);
  const [tab, setTab] = useState<"settings" | "cats" | "products" | "orders" | "announcements" | "preview" | "modules">("settings");
  
  // Estado de módulos del portal
  const [portalModules, setPortalModules] = useState({
    portalEnabled: true,
    pedidos: { enabled: true, name: "Pedidos de Almuerzo" },
    consumo: { enabled: true, name: "Detalle de Consumo" },
    pagos: { enabled: true, name: "Mis Pagos" },
  });
  const [loading, setLoading] = useState(false);

  // ---------- Estado Categorías ----------
  const [catName, setCatName] = useState("");
  const [catEditing, setCatEditing] = useState<CategoryT | null>(null);

  // ---------- Estado Anuncios ----------
  const { uploadImage, isUploading } = useImageUpload();
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    message: "",
    image: "",
    startAt: "",
    endAt: "",
  });
  const [announcementEditing, setAnnouncementEditing] = useState<AnnouncementT | null>(null);

  // ---------- Carga inicial ----------
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const loadAll = async () => {
      try {
        const s = await RTDBHelper.getData<AdminSettings>(RTDB_PATHS.lunch_settings);
        if (s) {
          setSettings({
            isOpen: s.isOpen ?? true,
            showPrices: s.showPrices ?? true,
            cutoffTime: s.cutoffTime || "11:00",
            allowSameDay: s.allowSameDay ?? true,
            orderWindow: s.orderWindow || { start: "", end: "" },
            version: s.version,
            updateSeq: s.updateSeq,
            updatedAt: s.updatedAt,
            forceMajor: s.forceMajor,
            whatsapp: {
              enabled: !!s.whatsapp?.enabled,
              phone: normalizePhone(s.whatsapp?.phone || ""),
            },
            enabledDays: s.enabledDays || {},
            disabledDays: s.disabledDays || {},
          });
        }

        const m = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
        if (m) setMenu(m);

        // Solo para el badge de la pestaña (cantidad de pedidos de hoy)
        const allOrders = await RTDBHelper.getData<Record<string, OrderT>>(
          RTDB_PATHS.lunch_orders
        );
        if (allOrders) setOrdersCount(Object.keys(allOrders).length);

        // Cargar anuncios
        const announcementsData = await RTDBHelper.getData<Record<string, AnnouncementT>>(
          "lunch_announcements"
        );
        if (announcementsData) {
          const announcementsList = Object.values(announcementsData)
            .filter(Boolean)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setAnnouncements(announcementsList);
        }

        // Cargar módulos del portal
        const modulesData = await RTDBHelper.getData<any>("family_portal_modules");
        if (modulesData) {
          setPortalModules(modulesData);
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
      const phone = normalizePhone(settings.whatsapp?.phone);

      // Construir objeto limpio
      const toSave: AdminSettings = {
        isOpen: settings.isOpen ?? true,
        showPrices: settings.showPrices ?? true,
        cutoffTime: settings.cutoffTime || "11:00",
        allowSameDay: settings.allowSameDay ?? true,
        orderWindow: {
          start: settings.orderWindow?.start || "",
          end: settings.orderWindow?.end || "",
        },
        enabledDays: settings.enabledDays || {},
        disabledDays: settings.disabledDays || {},
        whatsapp: { enabled: !!settings.whatsapp?.enabled, phone: phone || "" },
      };
      if (settings.version !== undefined) toSave.version = settings.version;
      if (settings.updateSeq !== undefined) toSave.updateSeq = settings.updateSeq;
      if (settings.forceMajor !== undefined) toSave.forceMajor = settings.forceMajor;

      // Fan-out con update: NO sobrescribe todo el nodo
      const base = RTDB_PATHS.lunch_settings;
      const updates: Record<string, any> = {
        [`${base}/isOpen`]: toSave.isOpen,
        [`${base}/showPrices`]: toSave.showPrices,
        [`${base}/cutoffTime`]: toSave.cutoffTime,
        [`${base}/allowSameDay`]: toSave.allowSameDay,
        [`${base}/orderWindow/start`]: toSave.orderWindow!.start,
        [`${base}/orderWindow/end`]: toSave.orderWindow!.end,
        [`${base}/enabledDays`]: toSave.enabledDays,
        [`${base}/disabledDays`]: toSave.disabledDays,
        [`${base}/whatsapp/phone`]: toSave.whatsapp!.phone,
        [`${base}/updatedAt`]: Date.now(),
      };
      if (toSave.version !== undefined) updates[`${base}/version`] = toSave.version;
      if (toSave.updateSeq !== undefined) updates[`${base}/updateSeq`] = toSave.updateSeq;
      if (toSave.forceMajor !== undefined) updates[`${base}/forceMajor`] = toSave.forceMajor;

      await RTDBHelper.updateData(updates);

      setSettings((prev) => ({ ...prev, whatsapp: { ...prev.whatsapp, phone } }));
      toast({ title: "✅ Configuración guardada exitosamente" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "❌ Error al guardar la configuración", variant: "destructive" });
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

  // ================== Acciones: Anuncios ==================
  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: "",
      message: "",
      image: "",
      startAt: "",
      endAt: "",
    });
    setAnnouncementEditing(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageDataUrl = await uploadImage(file);
      setAnnouncementForm(prev => ({ ...prev, image: imageDataUrl }));
      toast({ title: "Imagen cargada correctamente" });
    } catch (error: any) {
      toast({
        title: "Error al cargar la imagen",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveAnnouncement = async () => {
    const { title, message, image, startAt, endAt } = announcementForm;
    
    if (!title.trim()) {
      toast({ title: "El título es obligatorio", variant: "destructive" });
      return;
    }
    
    if (!startAt || !endAt) {
      toast({ title: "Las fechas de inicio y fin son obligatorias", variant: "destructive" });
      return;
    }

    const startTimestamp = new Date(startAt).getTime();
    const endTimestamp = new Date(endAt).getTime();

    if (endTimestamp <= startTimestamp) {
      toast({ title: "La fecha de fin debe ser posterior a la de inicio", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (announcementEditing) {
        // Actualizar anuncio existente
        await RTDBHelper.updateData({
          [`lunch_announcements/${announcementEditing.id}`]: {
            ...announcementEditing,
            title: title.trim(),
            message: message.trim(),
            image,
            startAt: startTimestamp,
            endAt: endTimestamp,
          },
        });
        toast({ title: "Anuncio actualizado" });
      } else {
        // Crear nuevo anuncio
        const newAnnouncement: Omit<AnnouncementT, "id"> = {
          title: title.trim(),
          message: message.trim(),
          image,
          startAt: startTimestamp,
          endAt: endTimestamp,
          active: true,
          createdAt: Date.now(),
          createdBy: user?.id,
        };
        
        const id = await RTDBHelper.pushData("lunch_announcements", newAnnouncement);
        await RTDBHelper.updateData({
          [`lunch_announcements/${id}/id`]: id,
        });
        toast({ title: "Anuncio creado" });
      }

      // Recargar anuncios
      const announcementsData = await RTDBHelper.getData<Record<string, AnnouncementT>>(
        "lunch_announcements"
      );
      if (announcementsData) {
        const announcementsList = Object.values(announcementsData)
          .filter(Boolean)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAnnouncements(announcementsList);
      }
      
      resetAnnouncementForm();
    } catch {
      toast({ title: "No se pudo guardar el anuncio", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const editAnnouncement = (announcement: AnnouncementT) => {
    setAnnouncementEditing(announcement);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message || "",
      image: announcement.image || "",
      startAt: format(new Date(announcement.startAt), "yyyy-MM-dd'T'HH:mm"),
      endAt: format(new Date(announcement.endAt), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const deleteAnnouncement = async (announcement: AnnouncementT) => {
    if (!confirm(`¿Eliminar anuncio "${announcement.title}"?`)) return;
    
    setLoading(true);
    try {
      await RTDBHelper.removeData(`lunch_announcements/${announcement.id}`);
      
      // Recargar anuncios
      const announcementsData = await RTDBHelper.getData<Record<string, AnnouncementT>>(
        "lunch_announcements"
      );
      if (announcementsData) {
        const announcementsList = Object.values(announcementsData)
          .filter(Boolean)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAnnouncements(announcementsList);
      }
      
      toast({ title: "Anuncio eliminado" });
    } catch {
      toast({ title: "No se pudo eliminar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleAnnouncementStatus = async (announcement: AnnouncementT) => {
    setLoading(true);
    try {
      await RTDBHelper.updateData({
        [`lunch_announcements/${announcement.id}/active`]: !announcement.active,
      });
      
      // Recargar anuncios
      const announcementsData = await RTDBHelper.getData<Record<string, AnnouncementT>>(
        "lunch_announcements"
      );
      if (announcementsData) {
        const announcementsList = Object.values(announcementsData)
          .filter(Boolean)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAnnouncements(announcementsList);
      }
      
      toast({ title: `Anuncio ${announcement.active ? 'desactivado' : 'activado'}` });
    } catch {
      toast({ title: "No se pudo cambiar el estado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ================== Acciones: Módulos del Portal ==================
  const savePortalModules = async () => {
    setLoading(true);
    try {
      await RTDBHelper.setData("family_portal_modules", portalModules);
      toast({ title: "✅ Configuración de módulos guardada" });
    } catch {
      toast({ title: "❌ Error al guardar módulos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {onBack && (
                  <Button
                    variant="ghost"
                    onClick={onBack}
                    size="sm"
                    className="flex items-center gap-1 sm:gap-2 px-2"
                    title="Volver al dashboard"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Volver</span>
                  </Button>
                )}
                <CardTitle className="text-xl sm:text-2xl font-bold">
                  Administración de Almuerzos
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground hidden md:block">
                Configura el portal, categorías y productos.
              </p>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4 sm:space-y-6">
          {/* Tabs optimizadas para móvil con scroll horizontal */}
          <div className="w-full overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-full sm:w-auto min-w-max sm:grid sm:grid-cols-7 h-auto">
              <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Configuración</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
              <TabsTrigger value="modules" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Módulos</span>
                <span className="sm:hidden">Mód</span>
              </TabsTrigger>
              <TabsTrigger value="cats" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Categorías</span>
                <span className="sm:hidden">Cats</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Productos</span>
                <span className="sm:hidden">Prods</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Historial ({ordersCount})</span>
                <span className="sm:hidden">Hist ({ordersCount})</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Megaphone className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Anuncios ({announcements.length})</span>
                <span className="sm:hidden">Anun ({announcements.length})</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Vista Previa</span>
                <span className="sm:hidden">Vista</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ================= Configuración ================= */}
          <TabsContent value="settings">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Configuración del portal de familias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {/* Switches principales - stack en móvil */}
                <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={settings.isOpen ?? false}
                      onCheckedChange={async (v) => {
                        setSettings({ ...settings, isOpen: v });
                        try {
                          await RTDBHelper.updateData({ [`${RTDB_PATHS.lunch_settings}/isOpen`]: v });
                          toast({ title: `Portal ${v ? 'abierto' : 'cerrado'}` });
                        } catch (error) {
                          console.error("Error al actualizar portal:", error);
                          toast({ title: "Error al actualizar configuración", variant: "destructive" });
                        }
                      }}
                    />
                    <Label className="text-sm sm:text-base">Portal abierto</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={settings.showPrices ?? true}
                      onCheckedChange={async (v) => {
                        setSettings({ ...settings, showPrices: v });
                        try {
                          await RTDBHelper.updateData({ [`${RTDB_PATHS.lunch_settings}/showPrices`]: v });
                          toast({ title: `Precios ${v ? 'mostrados' : 'ocultos'}` });
                        } catch (error) {
                          console.error("Error al actualizar precios:", error);
                          toast({ title: "Error al actualizar configuración", variant: "destructive" });
                        }
                      }}
                    />
                    <Label className="text-sm sm:text-base">Mostrar precios a familias</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={settings.allowSameDay ?? true}
                      onCheckedChange={(v) => setSettings({ ...settings, allowSameDay: v })}
                    />
                    <Label className="text-sm sm:text-base">Permitir mismo día</Label>
                  </div>
                </div>

                {/* Hora límite */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Hora límite</Label>
                  <Input
                    type="time"
                    value={settings.cutoffTime || "11:00"}
                    onChange={(e) => setSettings({ ...settings, cutoffTime: e.target.value })}
                    className="max-w-xs"
                  />
                </div>

                {/* Ventana de pedidos */}
                <div className="space-y-3">
                  <Label className="text-sm sm:text-base font-medium">Ventana de pedidos</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm text-muted-foreground">Desde</Label>
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
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm text-muted-foreground">Hasta</Label>
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
                </div>

                {/* Días no habilitados */}
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <Label className="text-sm sm:text-base font-medium">Días no habilitados para productos variados</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Selecciona qué días NO estarán disponibles
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 sm:gap-3">
                    {[
                      { key: 'monday', label: 'Lun', fullLabel: 'Lunes' },
                      { key: 'tuesday', label: 'Mar', fullLabel: 'Martes' },
                      { key: 'wednesday', label: 'Mié', fullLabel: 'Miércoles' },
                      { key: 'thursday', label: 'Jue', fullLabel: 'Jueves' },
                      { key: 'friday', label: 'Vie', fullLabel: 'Viernes' },
                      { key: 'saturday', label: 'Sáb', fullLabel: 'Sábado' },
                      { key: 'sunday', label: 'Dom', fullLabel: 'Domingo' },
                    ].map(({ key, label, fullLabel }) => (
                      <div key={key} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Switch
                          checked={settings.disabledDays?.[key as keyof typeof settings.disabledDays] ?? false}
                          onCheckedChange={(v) =>
                            setSettings({
                              ...settings,
                              disabledDays: {
                                ...settings.disabledDays,
                                [key]: v,
                              },
                            })
                          }
                        />
                        <Label className="text-xs sm:text-sm">
                          <span className="sm:hidden">{label}</span>
                          <span className="hidden sm:inline">{fullLabel}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={!!settings.whatsapp?.enabled}
                      onCheckedChange={(v) =>
                        setSettings({
                          ...settings,
                          whatsapp: { ...(settings.whatsapp || {}), enabled: v },
                        })
                      }
                    />
                    <Label className="text-sm sm:text-base">Enviar confirmación a WhatsApp</Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Número de WhatsApp</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Ej. 51987654321"
                      value={settings.whatsapp?.phone || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsapp: {
                            ...(settings.whatsapp || {}),
                            phone: normalizePhone(e.target.value),
                          },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Con código de país. Ejemplo Perú: <strong>51987654321</strong>
                    </p>
                  </div>
                </div>

                <Button type="button" onClick={saveSettings} disabled={loading} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  Guardar configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Categorías ================= */}
          <TabsContent value="cats">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">
                    {catEditing ? "Editar categoría" : "Nueva categoría"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4 sm:p-6">
                  <Input
                    placeholder="Ej. Almuerzos"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={saveCategory} disabled={loading} className="w-full sm:w-auto">
                      <Save className="h-4 w-4 mr-2" />
                      {catEditing ? "Guardar cambios" : "Crear"}
                    </Button>
                    {catEditing && (
                      <Button variant="outline" onClick={resetCatForm} className="w-full sm:w-auto">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Categorías</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 sm:p-6">
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay categorías.</p>
                  )}
                  {categories.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded p-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm sm:text-base">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Orden: {c.order ?? 0}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moveCategory(c, -1)}
                          disabled={i === 0}
                          title="Subir"
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moveCategory(c, +1)}
                          disabled={i === categories.length - 1}
                          title="Bajar"
                        >
                          ↓
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => editCategory(c)} title="Editar">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
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
            <ProductsPanel menu={menu} onMenuUpdate={setMenu} />
          </TabsContent>

          {/* ================= Historial de Pedidos ================= */}
          <TabsContent value="orders">
            <OrdersByDayView />
          </TabsContent>

          {/* ================= Anuncios ================= */}
          <TabsContent value="announcements">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {announcementEditing ? "Editar anuncio" : "Crear nuevo anuncio"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      placeholder="Título del anuncio"
                      value={announcementForm.title}
                      onChange={(e) =>
                        setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Mensaje (opcional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Mensaje adicional para mostrar debajo del título"
                      value={announcementForm.message}
                      onChange={(e) =>
                        setAnnouncementForm(prev => ({ ...prev, message: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="image">Imagen de portada</Label>
                    <div className="space-y-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      {announcementForm.image && (
                        <div className="relative">
                          <img
                            src={announcementForm.image}
                            alt="Vista previa"
                            className="w-full max-w-md h-48 object-cover rounded-lg border"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() =>
                              setAnnouncementForm(prev => ({ ...prev, image: "" }))
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startAt">Fecha y hora de inicio</Label>
                      <Input
                        id="startAt"
                        type="datetime-local"
                        value={announcementForm.startAt}
                        onChange={(e) =>
                          setAnnouncementForm(prev => ({ ...prev, startAt: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="endAt">Fecha y hora de fin</Label>
                      <Input
                        id="endAt"
                        type="datetime-local"
                        value={announcementForm.endAt}
                        onChange={(e) =>
                          setAnnouncementForm(prev => ({ ...prev, endAt: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={saveAnnouncement} 
                      disabled={loading || isUploading}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {announcementEditing ? "Guardar cambios" : "Crear anuncio"}
                    </Button>
                    {announcementEditing && (
                      <Button variant="outline" onClick={resetAnnouncementForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Anuncios existentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {announcements.length === 0 ? (
                    <p className="text-muted-foreground">No hay anuncios creados.</p>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map((announcement) => {
                        const now = Date.now();
                        const isActive = announcement.active && 
                          now >= announcement.startAt && 
                          now <= announcement.endAt;
                        const isExpired = now > announcement.endAt;
                        
                        return (
                          <div
                            key={announcement.id}
                            className={`border rounded-lg p-4 ${
                              isActive 
                                ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                : isExpired 
                                ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{announcement.title}</h3>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    isActive 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : isExpired 
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      : announcement.active 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                  }`}>
                                    {isActive ? 'Activo' : isExpired ? 'Expirado' : announcement.active ? 'Programado' : 'Inactivo'}
                                  </span>
                                </div>
                                
                                {announcement.message && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {announcement.message}
                                  </p>
                                )}
                                
                                <div className="text-xs text-muted-foreground">
                                  <div>Inicio: {format(new Date(announcement.startAt), "dd/MM/yyyy HH:mm")}</div>
                                  <div>Fin: {format(new Date(announcement.endAt), "dd/MM/yyyy HH:mm")}</div>
                                </div>
                              </div>
                              
                              {announcement.image && (
                                <img
                                  src={announcement.image}
                                  alt={announcement.title}
                                  className="w-20 h-20 object-cover rounded border"
                                />
                              )}
                              
                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editAnnouncement(announcement)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={announcement.active ? "secondary" : "default"}
                                  size="sm"
                                  onClick={() => toggleAnnouncementStatus(announcement)}
                                  disabled={loading}
                                >
                                  {announcement.active ? 'Desactivar' : 'Activar'}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteAnnouncement(announcement)}
                                  disabled={loading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================= Módulos del Portal ================= */}
          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle>Control de Módulos del Portal de Familias</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Administra qué módulos están activos en el portal de familias
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Switch general del portal */}
                <div className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Portal de Familias</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Controla si el portal completo está disponible o en mantenimiento
                      </p>
                    </div>
                    <Switch
                      checked={portalModules.portalEnabled}
                      onCheckedChange={(v) =>
                        setPortalModules({ ...portalModules, portalEnabled: v })
                      }
                    />
                  </div>
                </div>

                {/* Módulo de Pedidos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Módulos Disponibles</h3>
                  
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">
                          {portalModules.pedidos?.name || "Pedidos de Almuerzo"}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Permite a las familias realizar pedidos de almuerzo
                        </p>
                      </div>
                      <Switch
                        checked={portalModules.pedidos?.enabled ?? true}
                        onCheckedChange={(v) =>
                          setPortalModules({
                            ...portalModules,
                            pedidos: {
                              ...portalModules.pedidos,
                              enabled: v,
                            },
                          })
                        }
                        disabled={!portalModules.portalEnabled}
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">
                          {portalModules.consumo?.name || "Detalle de Consumo"}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Muestra el historial de compras y consumo del estudiante
                        </p>
                      </div>
                      <Switch
                        checked={portalModules.consumo?.enabled ?? true}
                        onCheckedChange={(v) =>
                          setPortalModules({
                            ...portalModules,
                            consumo: {
                              ...portalModules.consumo,
                              enabled: v,
                            },
                          })
                        }
                        disabled={!portalModules.portalEnabled}
                      />
                    </div>
                  </div>

                  {/* Módulo de Pagos */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">
                          {portalModules.pagos?.name || "Mis Pagos"}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Permite a las familias gestionar sus pagos y ver deudas pendientes
                        </p>
                      </div>
                      <Switch
                        checked={portalModules.pagos?.enabled ?? true}
                        onCheckedChange={(v) =>
                          setPortalModules({
                            ...portalModules,
                            pagos: {
                              ...portalModules.pagos,
                              enabled: v,
                            },
                          })
                        }
                        disabled={!portalModules.portalEnabled}
                      />
                    </div>
                  </div>

                  {/* Aquí se pueden agregar más módulos en el futuro */}
                  <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                    <p className="text-sm">Más módulos próximamente...</p>
                  </div>
                </div>

                {/* Botón guardar */}
                <div className="pt-4 border-t">
                  <Button onClick={savePortalModules} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar configuración de módulos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Vista Previa ================= */}
          <TabsContent value="preview">
            <FamilyPortalPreview />
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${s || "id"}-${Math.random().toString(36).slice(2, 6)}`;
}

// src/hooks/useLunchData.ts
import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

export type Category = {
  id: string;
  name: string;
  order?: number;
  active?: boolean;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  active?: boolean;
  dailyLimit?: number;
};

export type Settings = {
  isOpen?: boolean;
  showPrices?: boolean;
  cutoffTime?: string;        // "11:00"
  allowEditsMinutes?: number; // 0..n
};

export type Promotion = {
  id: string;
  productId: string;
  percentOff: number; // 0-100
  startAt?: number;   // timestamp ms
  endAt?: number;     // timestamp ms
  active?: boolean;
};

type MenuData = {
  categories?: Record<string, Category>;
  products?: Record<string, Product>;
};

const MENU_PATH = RTDB_PATHS.lunch_menu;           // "lunch_menu"
const SETTINGS_PATH = RTDB_PATHS.lunch_settings;   // "lunch_settings"
const PROMOS_PATH = "lunch_promotions";            // nuevo nodo para promos

export function useLunchData() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [promos, setPromos] = useState<Record<string, Promotion>>({});
  const [loading, setLoading] = useState(true);

  // Listeners en vivo
  useEffect(() => {
    const offMenu = RTDBHelper.listenToData<MenuData>(MENU_PATH, (d) => {
      setMenu(d || { categories: {}, products: {} });
      setLoading(false);
    });
    const offSettings = RTDBHelper.listenToData<Settings>(SETTINGS_PATH, (d) => {
      setSettings(d || {});
    });
    const offPromos = RTDBHelper.listenToData<Record<string, Promotion>>(PROMOS_PATH, (d) => {
      setPromos(d || {});
    });

    return () => {
      offMenu?.();
      offSettings?.();
      offPromos?.();
    };
  }, []);

  const categories: Category[] = useMemo(
    () =>
      Object.values(menu?.categories || {})
        .filter(Boolean)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [menu]
  );

  const products: Product[] = useMemo(
    () => Object.values(menu?.products || {}).filter(Boolean),
    [menu]
  );

  // ===== CATEGORÍAS =====
  async function createCategory(payload: Omit<Category, "id">) {
    const id = await RTDBHelper.pushData(`${MENU_PATH}/categories`, { ...payload, active: payload.active ?? true });
    await RTDBHelper.updateData({ [`${MENU_PATH}/categories/${id}/id`]: id });
  }

  async function updateCategory(id: string, patch: Partial<Category>) {
    await RTDBHelper.updateData({ [`${MENU_PATH}/categories/${id}`]: { ...(menu?.categories?.[id] || {}), ...patch } });
  }

  async function deleteCategory(id: string) {
    // Si hay productos con esa categoría, solo bloqueamos (active:false).
    await RTDBHelper.updateData({ [`${MENU_PATH}/categories/${id}/active`]: false });
  }

  // ===== PRODUCTOS =====
  async function createProduct(payload: Omit<Product, "id">) {
    const id = await RTDBHelper.pushData(`${MENU_PATH}/products`, {
      ...payload,
      active: payload.active ?? true,
      dailyLimit: payload.dailyLimit ?? 0,
    });
    await RTDBHelper.updateData({ [`${MENU_PATH}/products/${id}/id`]: id });
  }

  async function updateProduct(id: string, patch: Partial<Product>) {
    await RTDBHelper.updateData({ [`${MENU_PATH}/products/${id}`]: { ...(menu?.products?.[id] || {}), ...patch } });
  }

  async function deleteProduct(id: string) {
    await RTDBHelper.updateData({ [`${MENU_PATH}/products/${id}/active`]: false });
  }

  // ===== SETTINGS =====
  async function saveSettings(newSettings: Settings) {
    await RTDBHelper.setData(SETTINGS_PATH, newSettings);
  }

  // ===== PROMOS =====
  async function createPromo(payload: Omit<Promotion, "id">) {
    const id = await RTDBHelper.pushData(PROMOS_PATH, { ...payload, active: payload.active ?? true });
    await RTDBHelper.updateData({ [`${PROMOS_PATH}/${id}/id`]: id });
  }

  async function updatePromo(id: string, patch: Partial<Promotion>) {
    await RTDBHelper.updateData({ [`${PROMOS_PATH}/${id}`]: { ...(promos?.[id] || {}), ...patch } });
  }

  async function deletePromo(id: string) {
    await RTDBHelper.updateData({ [`${PROMOS_PATH}/${id}/active`]: false });
  }

  return {
    loading,
    categories,
    products,
    settings,
    promos: Object.values(promos || {}),
    // CRUD
    createCategory,
    updateCategory,
    deleteCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    saveSettings,
    createPromo,
    updatePromo,
    deletePromo,
  };
}

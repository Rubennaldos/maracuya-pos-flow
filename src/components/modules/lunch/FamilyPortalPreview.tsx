import React, { useEffect, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Trash2, Eye } from "lucide-react";
import type { SettingsT, MenuT, ProductT } from "@/components/modules/lunch/types";

// Tipos para el carrito de prueba
type CartItem = ProductT & {
  quantity: number;
  subtotal: number;
  selectedDays?: string[];
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function FamilyPortalPreview() {
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [menu, setMenu] = useState<MenuT>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
  const categories = Object.values(menu.categories || {})
    .filter((cat) => cat && typeof cat === "object")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const productsByCategory = categories.reduce((acc, cat) => {
    const products = Object.values(menu.products || {})
      .filter((p) => p && p.categoryId === cat.id && p.active !== false)
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : (typeof a.order === 'string' ? parseInt(a.order) || 0 : 0);
        const orderB = typeof b.order === 'number' ? b.order : (typeof b.order === 'string' ? parseInt(b.order) || 0 : 0);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    acc[cat.id] = products;
    return acc;
  }, {} as Record<string, ProductT[]>);

  // Funciones del carrito (demo - no guarda datos)
  const addToCart = (product: ProductT) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * (item.price ?? 0) }
            : item
        );
      } else {
        return [...prev, {
          ...product,
          quantity: 1,
          subtotal: product.price ?? 0
        }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * (item.price ?? 0) }
            : item
        );
      } else {
        return prev.filter(item => item.id !== productId);
      }
    });
  };

  const clearCart = () => setCart([]);

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
          Esta es una simulación de cómo ven los padres el portal de almuerzos. 
          Los datos mostrados son reales pero el carrito no se guarda.
        </div>
      </CardHeader>
      <CardContent>
        {/* Simulación de la interfaz de familias */}
        <div className="border rounded-lg p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          {/* Header simulado */}
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">¡Hola, Usuario de Prueba!</h2>
              <Badge variant="secondary">ID: DEMO001</Badge>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Menú */}
            <div className="lg:col-span-2 space-y-4">
              {/* Categorías */}
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
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{product.name}</h3>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {product.description}
                            </p>
                          )}
                          {settings?.showPrices && product.price && (
                            <div className="text-lg font-bold text-primary mt-2">
                              {PEN(product.price)}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => addToCart(product)}
                          size="sm"
                          className="ml-4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {categories.length === 0 
                      ? "No hay categorías configuradas"
                      : "No hay productos en esta categoría"
                    }
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
                      {cart.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {PEN(item.price ?? 0)} × {item.quantity}
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

                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center font-bold">
                          <span>Total:</span>
                          <span>{PEN(total)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Button className="w-full" disabled>
                          Confirmar Pedido (Demo)
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={clearCart}
                        >
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

          {/* Footer simulado */}
          <div className="text-center mt-6 pt-4 border-t text-xs text-muted-foreground">
            Maracuyá • Portal de Almuerzos • Vista Previa de Administrador
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
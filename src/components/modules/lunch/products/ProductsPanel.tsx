// src/components/modules/lunch/products/ProductsPanel.tsx
import { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { ProductT, MenuT } from "../types";
import { formatDateForPeru, isDatePast } from "../utils/dateUtils";

type Props = {
  menu: MenuT;
  onMenuUpdate: (menu: MenuT) => void;
};

// 🔧 helper: elimina claves con undefined (RTDB no las acepta)
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) clean[k] = v;
  });
  return clean as T;
}

export default function ProductsPanel({ menu, onMenuUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ProductT | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    type: "lunch" as "lunch" | "varied",
    specificDate: "",
    image: ""
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      categoryId: "",
      type: "lunch",
      specificDate: "",
      image: ""
    });
    setSelectedDate(undefined);
    setEditing(null);
    setShowForm(false);
  };

  // Categories for dropdown
  const categories = useMemo(() => {
    return Object.values(menu?.categories || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  // Products grouped by category and filtered by date validity
  const productsByCategory = useMemo(() => {
    const products = Object.values(menu?.products || {});
    const result: Record<string, ProductT[]> = {};

    products.forEach(product => {
      if (!product) return;

      // Oculta almuerzos de días pasados
      if (product.type === "lunch" && product.specificDate && isDatePast(product.specificDate)) {
        return;
      }

      const categoryId = product.categoryId || "sin-categoria";
      if (!result[categoryId]) result[categoryId] = [];
      result[categoryId].push(product);
    });

    // Orden por posición
    Object.keys(result).forEach(catId => {
      result[catId].sort((a, b) => {
        const posA = Number(a.position) || 0;
        const posB = Number(b.position) || 0;
        return posA - posB;
      });
    });

    return result;
  }, [menu]);

  // Handle date selection
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        specificDate: formatDateForPeru(selectedDate)
      }));
    }
  }, [selectedDate]);

  // Load form for editing
  const editProduct = (product: ProductT) => {
    setEditing(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      categoryId: product.categoryId,
      type: product.type || "lunch",
      specificDate: product.specificDate || "",
      image: product.image || ""
    });

    if (product.specificDate) {
      setSelectedDate(new Date(product.specificDate + "T12:00:00"));
    }

    setShowForm(true);
  };

  // Save product
  const saveProduct = async () => {
    // Validaciones mínimas
    if (!formData.name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (!formData.price || isNaN(Number(formData.price))) {
      toast({ title: "El precio debe ser un número válido", variant: "destructive" });
      return;
    }
    if (!formData.categoryId) {
      toast({ title: "Debe seleccionar una categoría", variant: "destructive" });
      return;
    }
    if (formData.type === "lunch" && !formData.specificDate) {
      toast({ title: "Debe seleccionar una fecha para productos de almuerzo", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // arma payload sin undefined
      const productData = stripUndefined<Partial<ProductT>>({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: Number(formData.price),
        categoryId: formData.categoryId,
        type: formData.type,
        specificDate: formData.type === "lunch" ? formData.specificDate : undefined,
        image: formData.image || undefined,
        active: true,
        position: editing?.position ?? 0,
      });

      if (editing) {
        // Actualizar producto
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${editing.id}`]: {
            ...editing,
            ...productData,
            id: editing.id,
          },
        });
        toast({ title: "Producto actualizado" });
      } else {
        // Crear nuevo producto
        const id = await RTDBHelper.pushData(`${RTDB_PATHS.lunch_menu}/products`, productData);
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${id}/id`]: id,
        });
        toast({ title: "Producto creado" });
      }

      // Recargar menú desde RTDB
      const updatedMenu = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (updatedMenu) onMenuUpdate(updatedMenu);

      resetForm();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      toast({ title: "Error al guardar producto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Delete product (soft delete: active=false)
  const deleteProduct = async (product: ProductT) => {
    if (!confirm(`¿Eliminar producto "${product.name}"?`)) return;

    setLoading(true);
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_menu}/products/${product.id}/active`]: false,
      });

      const updatedMenu = await RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu);
      if (updatedMenu) onMenuUpdate(updatedMenu);

      toast({ title: "Producto eliminado" });
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      toast({ title: "Error al eliminar producto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Product Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Productos</h3>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </div>

      {/* Product Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del producto"
                />
              </div>

              <div>
                <Label htmlFor="price">Precio *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="type">Tipo de Producto *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "lunch" | "varied") => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunch">Almuerzo (día específico)</SelectItem>
                    <SelectItem value="varied">Variado (selección de días)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === "lunch" && (
                <div className="md:col-span-2">
                  <Label>Fecha del Almuerzo *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date()}
                        className="pointer-events-auto"
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del producto (opcional)"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={saveProduct} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      <div className="space-y-4">
        {categories.map(category => {
          const products = productsByCategory[category.id] || [];
          if (products.length === 0) return null;

        /* eslint-disable react/jsx-key */
          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="text-base">{category.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {products.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{product.name}</h4>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              product.type === "lunch" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                            }`}
                          >
                            {product.type === "lunch" ? "Almuerzo" : "Variado"}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground">{product.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-semibold">S/ {product.price.toFixed(2)}</span>
                          {product.type === "lunch" && product.specificDate && (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(product.specificDate + "T12:00:00"), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => editProduct(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteProduct(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {Object.keys(productsByCategory).length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No hay productos disponibles.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Los productos de almuerzo de días pasados se ocultan automáticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

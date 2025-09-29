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
import { CalendarIcon, Plus, Edit, Trash2, Save, X, Upload } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useImageUpload } from "@/hooks/useImageUpload";

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
  const { uploadImage, isUploading } = useImageUpload();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    type: "lunch" as "lunch" | "varied",
    specificDate: "",
    image: "",
    // Campos específicos para almuerzo
    entrada: "",
    segundo: "",
    postre: "",
    refresco: "Refresco del día",
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
      image: "",
      entrada: "",
      segundo: "",
      postre: "",
      refresco: "Refresco del día",
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

    products.forEach((product) => {
      if (!product) return;

      // Oculta almuerzos de días pasados
      if (product.type === "lunch" && product.specificDate && isDatePast(product.specificDate)) {
        return;
      }

      const categoryId = (product as any).categoryId || "sin-categoria";
      if (!result[categoryId]) result[categoryId] = [];
      result[categoryId].push(product);
    });

    // Orden por posición
    Object.keys(result).forEach((catId) => {
      result[catId].sort((a: any, b: any) => {
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
      setFormData((prev) => ({
        ...prev,
        specificDate: formatDateForPeru(selectedDate),
      }));
    }
  }, [selectedDate]);

  // Load form for editing
  const editProduct = (product: ProductT) => {
    setEditing(product);
    setFormData({
      name: (product as any).name,
      description: (product as any).description || "",
      price: String((product as any).price),
      categoryId: (product as any).categoryId,
      type: (product as any).type || "lunch",
      specificDate: (product as any).specificDate || "",
      image: (product as any).image || "",
      entrada: (product as any).entrada || "",
      segundo: (product as any).segundo || "",
      postre: (product as any).postre || "",
      refresco: (product as any).refresco || "Refresco del día",
    });

    if ((product as any).specificDate) {
      setSelectedDate(new Date((product as any).specificDate + "T12:00:00"));
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
        position: editing ? (editing as any).position ?? 0 : 0,
        // Campos específicos para almuerzo (opcionales)
        ...(formData.type === "lunch" && {
          entrada: formData.entrada.trim() || undefined,
          segundo: formData.segundo.trim() || undefined,
          postre: formData.postre.trim() || undefined,
          refresco: formData.refresco.trim() || "Refresco del día",
        }),
      });

      if (editing) {
        // Actualizar producto
        await RTDBHelper.updateData({
          [`${RTDB_PATHS.lunch_menu}/products/${(editing as any).id}`]: {
            ...(editing as any),
            ...productData,
            id: (editing as any).id,
          },
        });
        toast({ title: "Producto actualizado" });
      } else {
        // Crear nuevo producto
        const id = await RTDBHelper.pushData(`${RTDB_PATHS.lunch_menu}/products`, productData as any);
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

  // Delete product (hard delete)
  const deleteProduct = async (product: ProductT) => {
    if (!confirm(`¿Eliminar producto "${(product as any).name}"?`)) return;

    setLoading(true);
    try {
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_menu}/products/${(product as any).id}`]: null,
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoría *</Label>
                <Select value={formData.categoryId} onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="type">Tipo de Producto *</Label>
                <Select value={formData.type} onValueChange={(value: "lunch" | "varied") => setFormData((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunch">Almuerzo (día específico)</SelectItem>
                    <SelectItem value="varied">Variado (selección de días)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos específicos para productos de almuerzo */}
            {formData.type === "lunch" && (
              <div className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entrada">Entrada</Label>
                    <Input
                      id="entrada"
                      value={formData.entrada}
                      onChange={(e) => setFormData((prev) => ({ ...prev, entrada: e.target.value }))}
                      placeholder="Ej: Ensalada mixta"
                    />
                  </div>

                  <div>
                    <Label htmlFor="segundo">Segundo</Label>
                    <Input
                      id="segundo"
                      value={formData.segundo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, segundo: e.target.value }))}
                      placeholder="Ej: Pollo a la plancha con arroz"
                    />
                  </div>

                  <div>
                    <Label htmlFor="postre">Postre</Label>
                    <Input
                      id="postre"
                      value={formData.postre}
                      onChange={(e) => setFormData((prev) => ({ ...prev, postre: e.target.value }))}
                      placeholder="Ej: Gelatina de fresa"
                    />
                  </div>

                  <div>
                    <Label htmlFor="refresco">Refresco</Label>
                    <Input
                      id="refresco"
                      value={formData.refresco}
                      onChange={(e) => setFormData((prev) => ({ ...prev, refresco: e.target.value }))}
                      placeholder="Refresco del día"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <Label htmlFor="description">Observación (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Alguna nota u observación para este producto"
                rows={3}
              />
            </div>

            {/* Upload de imagen */}
            <div className="md:col-span-2">
              <Label>Imagen del producto</Label>
              <div className="mt-2">
                {formData.image ? (
                  <div className="relative">
                    <img src={formData.image} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const imageUrl = await uploadImage(file);
                            setFormData((prev) => ({ ...prev, image: imageUrl }));
                          } catch (error) {
                            toast({
                              title: "Error al subir imagen",
                              description: error instanceof Error ? error.message : "Error desconocido",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploading}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-center">
                        <span className="font-medium">Subir imagen</span>
                        <br />
                        <span className="text-xs text-muted-foreground">PNG, JPG hasta 5MB (se convertirá a WebP)</span>
                      </div>
                      {isUploading && <div className="text-xs text-blue-600">Subiendo...</div>}
                    </label>
                  </div>
                )}
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
        {categories.map((category) => {
          const products = productsByCategory[category.id] || [];
          if (products.length === 0) return null;

          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="text-base">{category.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {products.map((product: any) => (
                    <div key={product.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{product.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded ${product.type === "lunch" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                            {product.type === "lunch" ? "Almuerzo" : "Variado"}
                          </span>
                        </div>

                        {/* Observación */}
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-1">Observación: {product.description}</p>
                        )}

                        {/* Detalle de menú si es almuerzo */}
                        {product.type === "lunch" && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {product.entrada && (
                              <div>
                                <span className="text-muted-foreground">Entrada: </span>
                                <span>{product.entrada}</span>
                              </div>
                            )}
                            {product.segundo && (
                              <div>
                                <span className="text-muted-foreground">Segundo: </span>
                                <span>{product.segundo}</span>
                              </div>
                            )}
                            {product.postre && (
                              <div>
                                <span className="text-muted-foreground">Postre: </span>
                                <span>{product.postre}</span>
                              </div>
                            )}
                            {product.refresco && (
                              <div>
                                <span className="text-muted-foreground">Refresco: </span>
                                <span>{product.refresco}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-2">
                          <span className="font-semibold">S/ {Number(product.price).toFixed(2)}</span>
                          {product.type === "lunch" && product.specificDate && (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(product.specificDate + "T12:00:00"), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            console.log("Edit button clicked for product:", product);
                            editProduct(product as ProductT);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            console.log("Delete button clicked for product:", product);
                            deleteProduct(product as ProductT);
                          }}
                        >
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
            <p className="text-sm text-muted-foreground mt-2">Los productos de almuerzo de días pasados se ocultan automáticamente.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

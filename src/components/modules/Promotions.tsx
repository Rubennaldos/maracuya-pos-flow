import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Search, Plus, Edit, Trash2, Gift,
  Package, DollarSign, Percent, Tag
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Load products from RTDB
const loadProducts = async () => {
  try {
    const productsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.products);
    if (productsData) {
      return Object.values(productsData);
    }
    return [];
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
};
  { id: '1', name: 'Ensalada César', price: 12.50 },
  { id: '2', name: 'Sandwich Integral', price: 8.50 },
  { id: '3', name: 'Jugo Natural', price: 6.00 },
  { id: '4', name: 'Wrap de Pollo', price: 14.00 },
  { id: '5', name: 'Bowl de Quinoa', price: 16.00 }
];

// Load promotions from RTDB
const loadPromotions = async () => {
  try {
    const promotionsData = await RTDBHelper.getData<Record<string, Promotion>>(RTDB_PATHS.promotions);
    if (promotionsData) {
      return Object.values(promotionsData);
    }
    return [];
  } catch (error) {
    console.error('Error loading promotions:', error);
    return [];
  }
};
  {
    id: '1',
    name: 'Combo Saludable',
    products: [
      { id: '1', name: 'Ensalada César', price: 12.50 },
      { id: '3', name: 'Jugo Natural', price: 6.00 }
    ],
    customItems: [],
    originalPrice: 18.50,
    finalPrice: 15.00,
    discount: 3.50,
    discountType: 'amount' as 'amount',
    isActive: true
  },
  {
    id: '2',
    name: 'Almuerzo Completo',
    products: [
      { id: '4', name: 'Wrap de Pollo', price: 14.00 },
      { id: '5', name: 'Bowl de Quinoa', price: 16.00 }
    ],
    customItems: ['Postre del día'],
    originalPrice: 30.00,
    finalPrice: 25.00,
    discount: 5.00,
    discountType: 'amount' as 'amount',
    isActive: true
  }
];

interface Promotion {
  id: string;
  name: string;
  products: Array<{ id: string; name: string; price: number }>;
  customItems: string[];
  originalPrice: number;
  finalPrice: number;
  discount: number;
  discountType: 'amount' | 'percentage';
  isActive: boolean;
}

interface PromotionsProps {
  onBack: () => void;
}

export const Promotions = ({ onBack }: PromotionsProps) => {
  const [promotions, setPromotions] = useState<Promotion[]>(MOCK_PROMOTIONS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  const [newPromo, setNewPromo] = useState({
    name: '',
    selectedProducts: [] as string[],
    customItems: [] as string[],
    finalPrice: 0,
    discountType: 'amount' as 'amount' | 'percentage',
    discount: 0
  });
  const [customItemInput, setCustomItemInput] = useState('');

  const filteredPromotions = promotions.filter(promo =>
    promo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotals = () => {
    const selectedProductsData = MOCK_PRODUCTS.filter(p => 
      newPromo.selectedProducts.includes(p.id)
    );
    const originalPrice = selectedProductsData.reduce((sum, p) => sum + p.price, 0);
    
    let finalPrice = newPromo.finalPrice;
    let discount = 0;
    
    if (newPromo.discountType === 'amount') {
      discount = newPromo.discount;
      finalPrice = originalPrice - discount;
    } else {
      discount = (originalPrice * newPromo.discount) / 100;
      finalPrice = originalPrice - discount;
    }
    
    return { originalPrice, finalPrice, discount };
  };

  const savePromotion = () => {
    const selectedProductsData = MOCK_PRODUCTS.filter(p => 
      newPromo.selectedProducts.includes(p.id)
    );
    const totals = calculateTotals();
    
    const promotion: Promotion = {
      id: editingPromo?.id || Date.now().toString(),
      name: newPromo.name,
      products: selectedProductsData,
      customItems: newPromo.customItems,
      originalPrice: totals.originalPrice,
      finalPrice: totals.finalPrice,
      discount: totals.discount,
      discountType: newPromo.discountType,
      isActive: true
    };

    if (editingPromo) {
      setPromotions(prev => prev.map(p => 
        p.id === editingPromo.id ? promotion : p
      ));
    } else {
      setPromotions(prev => [...prev, promotion]);
    }

    resetForm();
    setIsCreateDialogOpen(false);
  };

  const resetForm = () => {
    setNewPromo({
      name: '',
      selectedProducts: [],
      customItems: [],
      finalPrice: 0,
      discountType: 'amount',
      discount: 0
    });
    setCustomItemInput('');
    setEditingPromo(null);
  };

  const startEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setNewPromo({
      name: promo.name,
      selectedProducts: promo.products.map(p => p.id),
      customItems: promo.customItems,
      finalPrice: promo.finalPrice,
      discountType: promo.discountType,
      discount: promo.discount
    });
    setIsCreateDialogOpen(true);
  };

  const toggleProductSelection = (productId: string) => {
    setNewPromo(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(productId)
        ? prev.selectedProducts.filter(id => id !== productId)
        : [...prev.selectedProducts, productId]
    }));
  };

  const addCustomItem = () => {
    if (customItemInput.trim()) {
      setNewPromo(prev => ({
        ...prev,
        customItems: [...prev.customItems, customItemInput.trim()]
      }));
      setCustomItemInput('');
    }
  };

  const removeCustomItem = (index: number) => {
    setNewPromo(prev => ({
      ...prev,
      customItems: prev.customItems.filter((_, i) => i !== index)
    }));
  };

  const deletePromotion = (promoId: string) => {
    setPromotions(prev => prev.filter(p => p.id !== promoId));
  };

  const togglePromoStatus = (promoId: string) => {
    setPromotions(prev => prev.map(p => 
      p.id === promoId ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Promociones y Combos</h1>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Promoción
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPromo ? 'Editar Promoción' : 'Crear Nueva Promoción'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="promoName">Nombre de la Promoción</Label>
                  <Input
                    id="promoName"
                    value={newPromo.name}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Combo Saludable"
                  />
                </div>

                <div>
                  <Label>Seleccionar Productos</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {MOCK_PRODUCTS.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={product.id}
                          checked={newPromo.selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                        <label htmlFor={product.id} className="text-sm flex-1">
                          {product.name} - S/ {product.price.toFixed(2)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Productos Personalizados</Label>
                  <div className="flex space-x-2 mt-2">
                    <Input
                      value={customItemInput}
                      onChange={(e) => setCustomItemInput(e.target.value)}
                      placeholder="Ej: Postre del día"
                      onKeyPress={(e) => e.key === 'Enter' && addCustomItem()}
                    />
                    <Button onClick={addCustomItem} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {newPromo.customItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {newPromo.customItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                          <span className="text-sm">{item}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomItem(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Descuento</Label>
                    <div className="flex space-x-4 mt-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="discountType"
                          checked={newPromo.discountType === 'amount'}
                          onChange={() => setNewPromo(prev => ({ ...prev, discountType: 'amount' }))}
                        />
                        <span className="text-sm">Monto</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="discountType"
                          checked={newPromo.discountType === 'percentage'}
                          onChange={() => setNewPromo(prev => ({ ...prev, discountType: 'percentage' }))}
                        />
                        <span className="text-sm">Porcentaje</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="discount">
                      Descuento {newPromo.discountType === 'percentage' ? '(%)' : '(S/)'}
                    </Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      value={newPromo.discount}
                      onChange={(e) => setNewPromo(prev => ({ 
                        ...prev, 
                        discount: parseFloat(e.target.value) || 0 
                      }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {newPromo.selectedProducts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Resumen de Precios</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Precio Original:</span>
                        <span>S/ {totals.originalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Descuento:</span>
                        <span className="text-destructive">- S/ {totals.discount.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Precio Final:</span>
                        <span className="text-primary">S/ {totals.finalPrice.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex space-x-2 pt-4">
                  <Button onClick={savePromotion} className="flex-1">
                    {editingPromo ? 'Actualizar' : 'Crear'} Promoción
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar promociones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromotions.map((promo) => (
            <Card key={promo.id} className={`transition-all duration-200 ${!promo.isActive ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Gift className="w-5 h-5 mr-2 text-primary" />
                    {promo.name}
                  </CardTitle>
                  {!promo.isActive && (
                    <Badge variant="secondary">Inactiva</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Productos incluidos:</h4>
                  <div className="space-y-1">
                    {promo.products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs">{product.name}</span>
                      </div>
                    ))}
                    {promo.customItems.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Precio Original:</span>
                    <span className="line-through text-muted-foreground">
                      S/ {promo.originalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Descuento:</span>
                    <span className="text-destructive">
                      - S/ {promo.discount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Precio Final:</span>
                    <span className="text-primary">S/ {promo.finalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(promo)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePromoStatus(promo.id)}
                  >
                    {promo.isActive ? 'Desactivar' : 'Activar'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. La promoción "{promo.name}" será eliminada permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePromotion(promo.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPromotions.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron promociones</h3>
            <p className="text-muted-foreground">Crea tu primera promoción para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
};
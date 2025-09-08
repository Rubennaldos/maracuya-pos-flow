import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Search, Plus, Edit, Trash2, Percent,
  Package, DollarSign, Tag, Eye, EyeOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newPromotion, setNewPromotion] = useState<Partial<Promotion>>({
    name: "",
    products: [],
    customItems: [],
    originalPrice: 0,
    finalPrice: 0,
    discount: 0,
    discountType: "amount",
    isActive: true
  });

  // Load data on mount
  useEffect(() => {
    loadProducts().then(setProducts);
    loadPromotions().then(setPromotions);
  }, []);

  const calculateOriginalPrice = () => {
    const selectedProductsData = products.filter((p: any) => 
      selectedProducts.includes(p.id)
    );
    const basePrice = selectedProductsData.reduce((sum: number, p: any) => sum + (p.salePrice || p.price || 0), 0);
    setNewPromotion(prev => ({ ...prev, originalPrice: basePrice }));
  };

  const handleDiscountChange = (value: string, type: 'amount' | 'percentage') => {
    const discount = parseFloat(value) || 0;
    setNewPromotion(prev => ({ ...prev, discount, discountType: type }));
    
    const selectedProductsData = products.filter((p: any) => 
      selectedProducts.includes(p.id)
    );
    const basePrice = selectedProductsData.reduce((sum: number, p: any) => sum + (p.salePrice || p.price || 0), 0);
    
    let finalPrice = basePrice;
    if (type === 'amount') {
      finalPrice = Math.max(0, basePrice - discount);
    } else {
      finalPrice = Math.max(0, basePrice * (1 - discount / 100));
    }
    
    setNewPromotion(prev => ({ ...prev, finalPrice, originalPrice: basePrice }));
  };

  const savePromotion = async () => {
    try {
      const selectedProductsData = products.filter((p: any) => 
        selectedProducts.includes(p.id)
      );
      
      const promotionId = `PROMO${Date.now()}`;
      const promotionToSave: Promotion = {
        id: promotionId,
        name: newPromotion.name || '',
        products: selectedProductsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.salePrice || p.price || 0
        })),
        customItems: newPromotion.customItems || [],
        originalPrice: newPromotion.originalPrice || 0,
        finalPrice: newPromotion.finalPrice || 0,
        discount: newPromotion.discount || 0,
        discountType: newPromotion.discountType || 'amount',
        isActive: newPromotion.isActive !== false
      };

      // Save to RTDB
      await RTDBHelper.setData(`${RTDB_PATHS.promotions}/${promotionId}`, promotionToSave);
      
      // Update local state
      setPromotions([...promotions, promotionToSave]);
      
      // Reset form
      setNewPromotion({
        name: "",
        products: [],
        customItems: [],
        originalPrice: 0,
        finalPrice: 0,
        discount: 0,
        discountType: "amount",
        isActive: true
      });
      setSelectedProducts([]);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error saving promotion:', error);
      alert('Error al guardar la promoción');
    }
  };

  const togglePromotionStatus = async (promotionId: string) => {
    try {
      const promotion = promotions.find(p => p.id === promotionId);
      if (promotion) {
        const updatedPromotion = { ...promotion, isActive: !promotion.isActive };
        await RTDBHelper.setData(`${RTDB_PATHS.promotions}/${promotionId}`, updatedPromotion);
        
        setPromotions(promotions.map(p => 
          p.id === promotionId ? updatedPromotion : p
        ));
      }
    } catch (error) {
      console.error('Error updating promotion status:', error);
    }
  };

  const deletePromotion = async (promotionId: string) => {
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.promotions}/${promotionId}`);
      setPromotions(promotions.filter(p => p.id !== promotionId));
    } catch (error) {
      console.error('Error deleting promotion:', error);
    }
  };

  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPromotions = promotions.filter(promotion =>
    promotion.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Button>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6" />
            Promociones y Combos
          </h2>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Promoción
          </Button>
        </div>

        {/* Create Promotion Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Promoción</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="promotionName">Nombre de la Promoción</Label>
                <Input
                  id="promotionName"
                  value={newPromotion.name}
                  onChange={(e) => setNewPromotion({ ...newPromotion, name: e.target.value })}
                  placeholder="Ej: Combo Saludable"
                />
              </div>

              <div>
                <Label>Buscar y Seleccionar Productos</Label>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                  {filteredProducts.map((product: any) => (
                    <div key={product.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`product-${product.id}`}
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                        className="rounded"
                      />
                      <label
                        htmlFor={`product-${product.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {product.name} - S/ {(product.salePrice || product.price || 0).toFixed(2)}
                      </label>
                    </div>
                  ))}
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={calculateOriginalPrice}
                  className="mt-2"
                >
                  Calcular Precio Base
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="originalPrice">Precio Original (S/)</Label>
                  <Input
                    id="originalPrice"
                    type="number"
                    step="0.01"
                    value={newPromotion.originalPrice}
                    onChange={(e) => setNewPromotion({ ...newPromotion, originalPrice: parseFloat(e.target.value) || 0 })}
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="finalPrice">Precio Final (S/)</Label>
                  <Input
                    id="finalPrice"
                    type="number"
                    step="0.01"
                    value={newPromotion.finalPrice}
                    onChange={(e) => setNewPromotion({ ...newPromotion, finalPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de Descuento</Label>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="amount"
                      name="discountType"
                      checked={newPromotion.discountType === 'amount'}
                      onChange={() => setNewPromotion({ ...newPromotion, discountType: 'amount' })}
                    />
                    <Label htmlFor="amount">Monto (S/)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPromotion.discountType === 'amount' ? newPromotion.discount : ''}
                      onChange={(e) => handleDiscountChange(e.target.value, 'amount')}
                      className="w-24"
                      disabled={newPromotion.discountType !== 'amount'}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="percentage"
                      name="discountType"
                      checked={newPromotion.discountType === 'percentage'}
                      onChange={() => setNewPromotion({ ...newPromotion, discountType: 'percentage' })}
                    />
                    <Label htmlFor="percentage">Porcentaje (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPromotion.discountType === 'percentage' ? newPromotion.discount : ''}
                      onChange={(e) => handleDiscountChange(e.target.value, 'percentage')}
                      className="w-24"
                      disabled={newPromotion.discountType !== 'percentage'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Promoción Activa</Label>
                <Switch
                  id="isActive"
                  checked={newPromotion.isActive}
                  onCheckedChange={(checked) => setNewPromotion({ ...newPromotion, isActive: checked })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={savePromotion}>
                  Crear Promoción
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar promociones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Promotions Grid */}
        {filteredPromotions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPromotions.map((promotion) => (
              <Card key={promotion.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{promotion.name}</CardTitle>
                    <div className="flex gap-1">
                      <Badge variant={promotion.isActive ? "default" : "secondary"}>
                        {promotion.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Productos incluidos:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {promotion.products.map((product, index) => (
                          <li key={index}>• {product.name}</li>
                        ))}
                        {promotion.customItems.map((item, index) => (
                          <li key={`custom-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground line-through">
                        S/ {promotion.originalPrice.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          <Percent className="h-3 w-3 mr-1" />
                          {promotion.discountType === 'amount' 
                            ? `S/ ${promotion.discount.toFixed(2)} OFF`
                            : `${promotion.discount.toFixed(1)}% OFF`
                          }
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-xl font-bold flex items-center gap-1">
                      <DollarSign className="h-5 w-5" />
                      S/ {promotion.finalPrice.toFixed(2)}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePromotionStatus(promotion.id)}
                        className="flex-1"
                      >
                        {promotion.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. La promoción "{promotion.name}" será eliminada permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePromotion(promotion.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm ? 'No se encontraron promociones' : 'No hay promociones registradas'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza creando tu primera promoción o combo'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
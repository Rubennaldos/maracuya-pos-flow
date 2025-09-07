import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  ArrowLeft,
  Calendar,
  Save,
  Trash2
} from "lucide-react";

// Mock product data
const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Ensalada César',
    price: 12.50,
    cost: 8.00,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=300&fit=crop',
    category: 'Ensaladas'
  },
  {
    id: '2', 
    name: 'Sandwich Integral',
    price: 8.50,
    cost: 5.00,
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433a?w=300&h=300&fit=crop',
    category: 'Sandwiches'
  },
  {
    id: '3',
    name: 'Jugo Natural',
    price: 6.00,
    cost: 2.50,
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300&h=300&fit=crop',
    category: 'Bebidas'
  }
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface HistoricalSalesProps {
  onBack: () => void;
}

export const HistoricalSales = ({ onBack }: HistoricalSalesProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredProducts = MOCK_PRODUCTS.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1
        }];
      }
    });
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const processSale = () => {
    if (cart.length === 0) return;
    
    console.log('Processing historical sale:', {
      date: saleDate,
      items: cart,
      total: subtotal
    });
    
    // Clear cart after processing
    clearCart();
  };

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
            <h1 className="text-2xl font-bold text-foreground">Ventas Históricas</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="saleDate">Fecha de Venta:</Label>
              <Input
                id="saleDate"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-lg h-12"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id}
                className="cursor-pointer hover:shadow-medium transition-all duration-200 group border-2 hover:border-primary"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-0">
                  <div className="relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                  </div>
                  
                  <div className="p-3">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.category}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        S/ {product.price.toFixed(2)}
                      </span>
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-96 bg-card border-l border-border flex flex-col">
          {/* Cart Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Venta Histórica ({cart.length})
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Fecha: {new Date(saleDate).toLocaleDateString('es-PE')}
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Carrito vacío</p>
                <p className="text-sm text-muted-foreground">Seleccione productos para agregar</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.id} className="border border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{item.name}</h4>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="font-bold text-primary">
                        S/ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-border bg-card">
              <div className="space-y-3">
                <div className="flex justify-between text-xl">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-primary">S/ {subtotal.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Button 
                    onClick={processSale}
                    className="w-full h-12 text-lg bg-gradient-to-r from-primary to-primary-light"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Venta Histórica
                  </Button>
                  <Button variant="outline" onClick={clearCart} className="w-full">
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
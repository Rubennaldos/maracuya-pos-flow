import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Search, Plus, Minus, Calendar, 
  ShoppingCart, Clock, User, DollarSign
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
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

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface HistoricalSalesProps {
  onBack: () => void;
}

export const HistoricalSales = ({ onBack }: HistoricalSalesProps) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Load products from RTDB
  useEffect(() => {
    loadProducts().then(productsData => {
      setProducts(productsData);
    });
  }, []);

  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { 
        id: product.id, 
        name: product.name, 
        price: product.salePrice || product.price || 0, 
        quantity: 1 
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(item => 
        item.id === productId 
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.id !== productId));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  const processHistoricalSale = async () => {
    if (cart.length === 0) {
      alert('Agregue productos al carrito');
      return;
    }

    if (!selectedDate) {
      alert('Seleccione una fecha');
      return;
    }

    try {
      // Generate correlative for historical sales
      const correlative = await RTDBHelper.getNextCorrelative('historical');
      
      const saleData = {
        correlative,
        date: format(selectedDate, 'yyyy-MM-dd'),
        items: cart,
        total: getTotalAmount(),
        paymentMethod: 'credito', // Historical sales are always credit
        type: 'historical',
        user: 'Sistema', // You might want to get this from auth context
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Save to RTDB
      const saleId = await RTDBHelper.pushData(RTDB_PATHS.sales, saleData);
      
      // Register in accounts receivable
      // You'll need to implement client selection for this
      
      alert(`Venta histórica registrada con correlativo: ${correlative}`);
      clearCart();
    } catch (error) {
      console.error('Error processing historical sale:', error);
      alert('Error al procesar la venta histórica');
    }
  };

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
            <Clock className="h-6 w-6" />
            Ventas Históricas
          </h2>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product: any) => (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.category}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            <DollarSign className="h-3 w-3 mr-1" />
                            S/ {(product.salePrice || product.price || 0).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover ml-4"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No se encontraron productos</p>
              </div>
            )}
          </div>

          {/* Cart Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito de Venta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          S/ {item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Carrito vacío
                    </p>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    <div className="flex justify-between items-center font-medium">
                      <span>Total:</span>
                      <span>S/ {getTotalAmount().toFixed(2)}</span>
                    </div>
                    <div className="space-y-2">
                      <Button 
                        onClick={processHistoricalSale}
                        className="w-full"
                        disabled={cart.length === 0 || !selectedDate}
                      >
                        Registrar Venta Histórica
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={clearCart}
                        className="w-full"
                      >
                        Limpiar Carrito
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
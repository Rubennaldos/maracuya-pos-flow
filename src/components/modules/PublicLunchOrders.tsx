import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Minus,
  Clock,
  User
} from "lucide-react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/components/ui/use-toast";
import { initializeDemoLunchData } from "@/lib/demoData";

interface LunchMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  isActive: boolean;
  category: string;
  dailyLimit: number;
}

interface LunchOrder {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
  }>;
  note: string;
  total: number;
  status: "pending" | "preparing" | "delivered" | "canceled";
  createdAt: string;
  lastEditAt: string;
  deliveryAt?: string;
}

interface LunchSettings {
  cutoffTime: string;
  allowEditsMinutes: number;
  showPrices: boolean;
  deliveryTracking: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

const PublicLunchOrders = () => {
  const [studentCode, setStudentCode] = useState("");
  const [validatedStudent, setValidatedStudent] = useState<{ code: string; name: string } | null>(null);
  const [menu, setMenu] = useState<LunchMenuItem[]>([]);
  const [settings, setSettings] = useState<LunchSettings>({
    cutoffTime: "11:00",
    allowEditsMinutes: 15,
    showPrices: true,
    deliveryTracking: true
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [currentOrder, setCurrentOrder] = useState<LunchOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Load menu and settings
  useEffect(() => {
    const initializeData = async () => {
      // Initialize demo data first
      await initializeDemoLunchData();
      // Then load the data
      loadMenu();
      loadSettings();
    };
    
    initializeData();
  }, []);

  // Load existing order when student is validated
  useEffect(() => {
    if (validatedStudent) {
      loadTodayOrder();
    }
  }, [validatedStudent]);

  const loadMenu = async () => {
    try {
      const menuData = await RTDBHelper.getData<Record<string, LunchMenuItem>>(RTDB_PATHS.lunch_menu);
      if (menuData) {
        const menuArray = Object.values(menuData).filter(item => item.isActive);
        setMenu(menuArray);
      }
    } catch (error) {
      console.error("Error loading menu:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const settingsData = await RTDBHelper.getData<LunchSettings>(RTDB_PATHS.lunch_settings);
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadTodayOrder = async () => {
    if (!validatedStudent) return;
    
    try {
      const ordersData = await RTDBHelper.getData<Record<string, LunchOrder>>(RTDB_PATHS.lunch_orders);
      if (ordersData) {
        const today = new Date().toISOString().split('T')[0];
        const todayOrder = Object.values(ordersData).find(order => 
          order.code === validatedStudent.code && 
          order.createdAt.startsWith(today)
        );
        
        if (todayOrder) {
          setCurrentOrder(todayOrder);
          setCart(todayOrder.items);
          setNote(todayOrder.note || "");
        }
      }
    } catch (error) {
      console.error("Error loading today's order:", error);
    }
  };

  const validateStudent = async () => {
    if (!studentCode.trim()) {
      toast({
        title: "Error",
        description: "Ingrese el código del alumno",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Primero intentamos buscar directamente por código como ID
      let client = await RTDBHelper.getData(`${RTDB_PATHS.clients}/${studentCode}`);
      
      // Si no se encuentra, buscamos en toda la colección por el campo 'code'
      if (!client || !client.fullName) {
        console.log("Cliente no encontrado por ID directo, buscando en toda la colección...");
        const allClients = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
        
        if (allClients) {
          // Buscar por el campo 'code' o 'id' en todos los clientes
          const clientEntry = Object.entries(allClients).find(([key, clientData]) => {
            const data = clientData as any;
            return data.code === studentCode || 
                   data.id === studentCode || 
                   key === studentCode;
          });
          
          if (clientEntry) {
            client = clientEntry[1];
            console.log("Cliente encontrado:", client);
          }
        }
      }
      
      if (client && client.fullName) {
        setValidatedStudent({ code: studentCode, name: client.fullName });
        toast({
          title: "Código válido",
          description: `Alumno: ${client.fullName}`
        });
      } else {
        console.log("Cliente no encontrado para código:", studentCode);
        toast({
          title: "Código no encontrado",
          description: "Verifique el código del alumno",
          variant: "destructive"
        });
        setValidatedStudent(null);
      }
    } catch (error) {
      console.error("Error validating student:", error);
      toast({
        title: "Error",
        description: "Error al validar el código",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const addToCart = (item: LunchMenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem => 
          cartItem.id === item.id 
            ? { ...cartItem, qty: cartItem.qty + 1 }
            : cartItem
        );
      } else {
        return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
      }
    });
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.qty + change;
          return newQty > 0 ? { ...item, qty: newQty } : item;
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const isAfterCutoff = () => {
    const now = new Date();
    const cutoff = new Date();
    const [hours, minutes] = settings.cutoffTime.split(':').map(Number);
    cutoff.setHours(hours, minutes, 0, 0);
    return now > cutoff;
  };

  const canEdit = () => {
    if (!currentOrder) return true;
    if (currentOrder.status !== "pending" && currentOrder.status !== "preparing") return false;
    
    const orderTime = new Date(currentOrder.createdAt);
    const now = new Date();
    const minutesPassed = (now.getTime() - orderTime.getTime()) / (1000 * 60);
    return minutesPassed <= settings.allowEditsMinutes;
  };

  const confirmOrder = async () => {
    if (!validatedStudent || cart.length === 0) {
      toast({
        title: "Error",
        description: "Valide el código y agregue productos al carrito",
        variant: "destructive"
      });
      return;
    }

    if (isAfterCutoff()) {
      toast({
        title: "Hora límite superada",
        description: `No se pueden realizar pedidos después de las ${settings.cutoffTime}`,
        variant: "destructive"
      });
      return;
    }

    if (currentOrder && !canEdit()) {
      toast({
        title: "No se puede editar",
        description: "El pedido ya no puede ser modificado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const orderData: Omit<LunchOrder, 'id'> = {
        code: validatedStudent.code,
        clientId: validatedStudent.code,
        clientName: validatedStudent.name,
        items: cart,
        note: note.trim(),
        total,
        status: "pending",
        createdAt: currentOrder ? currentOrder.createdAt : new Date().toISOString(),
        lastEditAt: new Date().toISOString()
      };

      if (currentOrder) {
        // Update existing order
        await RTDBHelper.setData(`${RTDB_PATHS.lunch_orders}/${currentOrder.id}`, {
          ...orderData,
          id: currentOrder.id
        });
        setCurrentOrder({ ...orderData, id: currentOrder.id });
        toast({
          title: "Pedido actualizado",
          description: "Su pedido ha sido actualizado correctamente"
        });
      } else {
        // Create new order
        const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, orderData);
        setCurrentOrder({ ...orderData, id: orderId });
        toast({
          title: "Pedido confirmado",
          description: "Su pedido ha sido registrado correctamente"
        });
      }
    } catch (error) {
      console.error("Error confirming order:", error);
      toast({
        title: "Error",
        description: "Error al procesar el pedido",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const filteredMenu = menu.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">
              Almuerzos y Pedidos
            </CardTitle>
            <p className="text-muted-foreground">Sistema de pedidos para padres de familia</p>
          </CardHeader>
        </Card>

        {/* Student Validation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Código del Alumno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: C710796"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && validateStudent()}
                className="flex-1"
              />
              <Button onClick={validateStudent} disabled={loading}>
                Validar
              </Button>
            </div>
            {validatedStudent && (
              <div className="mt-3 p-3 bg-success/10 rounded-md border border-success/20">
                <p className="text-success font-medium">
                  ✓ Alumno: {validatedStudent.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {validatedStudent && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Menu */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Menú del Día</CardTitle>
                  <Input
                    placeholder="Buscar en el menú..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </CardHeader>
                <CardContent>
                  {isAfterCutoff() && (
                    <div className="mb-4 p-3 bg-warning/10 rounded-md border border-warning/20">
                      <div className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">
                          Hora límite superada ({settings.cutoffTime}). No se pueden realizar nuevos pedidos.
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredMenu.map((item) => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-16 h-16 object-cover rounded-md"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold">{item.name}</h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.description}
                              </p>
                              <div className="flex items-center justify-between">
                                {settings.showPrices && (
                                  <span className="font-bold text-primary">
                                    S/ {item.price.toFixed(2)}
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => addToCart(item)}
                                  disabled={isAfterCutoff()}
                                  className="ml-auto"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Añadir
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cart and Order */}
            <div className="space-y-6">
              {/* Cart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Carrito ({cart.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Carrito vacío
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            {settings.showPrices && (
                              <p className="text-sm text-muted-foreground">
                                S/ {item.price.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCartQuantity(item.id, -1)}
                              disabled={isAfterCutoff() || (currentOrder && !canEdit())}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.qty}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCartQuantity(item.id, 1)}
                              disabled={isAfterCutoff() || (currentOrder && !canEdit())}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Separator />
                      
                      <Textarea
                        placeholder="Observaciones (ej: sin cebolla)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={isAfterCutoff() || (currentOrder && !canEdit())}
                        className="mt-3"
                      />
                      
                      {settings.showPrices && (
                        <div className="font-bold text-lg">
                          Total: S/ {cartTotal.toFixed(2)}
                        </div>
                      )}
                      
                      <Button
                        className="w-full"
                        onClick={confirmOrder}
                        disabled={loading || cart.length === 0 || isAfterCutoff() || (currentOrder && !canEdit())}
                      >
                        {currentOrder ? "Actualizar Pedido" : "Confirmar Pedido"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Order Status */}
              {currentOrder && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Estado del Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Estado:</span>
                        <Badge variant={
                          currentOrder.status === "delivered" ? "default" :
                          currentOrder.status === "preparing" ? "secondary" :
                          "outline"
                        }>
                          {currentOrder.status === "pending" && "Pendiente"}
                          {currentOrder.status === "preparing" && "Preparando"}
                          {currentOrder.status === "delivered" && "Entregado"}
                          {currentOrder.status === "canceled" && "Cancelado"}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {new Date(currentOrder.createdAt).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      {settings.deliveryTracking && currentOrder.status === "delivered" && currentOrder.deliveryAt && (
                        <div className="p-2 bg-success/10 rounded-md border border-success/20">
                          <div className="flex items-center gap-2 text-success text-sm">
                            <CheckCircle className="h-4 w-4" />
                            Entregado a las {new Date(currentOrder.deliveryAt).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Productos:</p>
                        {currentOrder.items.map((item, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
                            {item.qty}x {item.name}
                          </p>
                        ))}
                      </div>
                      
                      {currentOrder.note && (
                        <div>
                          <p className="text-sm font-medium">Observaciones:</p>
                          <p className="text-sm text-muted-foreground">{currentOrder.note}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicLunchOrders;
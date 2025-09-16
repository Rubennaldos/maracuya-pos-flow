import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Save, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Clock,
  Package,
  Settings,
  FileText,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { toast } from "@/components/ui/use-toast";
import { useSession } from "@/state/session";

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

interface LunchAdminProps {
  onBack?: () => void;
}

const LunchAdmin = ({ onBack }: LunchAdminProps = {}) => {
  const { user } = useSession();
  const [menu, setMenu] = useState<LunchMenuItem[]>([]);
  const [settings, setSettings] = useState<LunchSettings>({
    cutoffTime: "11:00",
    allowEditsMinutes: 15,
    showPrices: true,
    deliveryTracking: true
  });
  const [todayOrders, setTodayOrders] = useState<LunchOrder[]>([]);
  const [editingItem, setEditingItem] = useState<LunchMenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<LunchMenuItem>>({
    name: "",
    description: "",
    price: 0,
    image: "",
    isActive: true,
    category: "",
    dailyLimit: 0
  });

  useEffect(() => {
    // Check if user has admin role
    if (!user || user.role !== 'admin') {
      toast({
        title: "Acceso denegado",
        description: "Solo administradores pueden acceder a este módulo",
        variant: "destructive"
      });
      return;
    }

    loadMenu();
    loadSettings();
    loadTodayOrders();
  }, [user]);

  const loadMenu = async () => {
    try {
      const menuData = await RTDBHelper.getData<Record<string, LunchMenuItem>>(RTDB_PATHS.lunch_menu);
      if (menuData) {
        setMenu(Object.values(menuData));
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

  const loadTodayOrders = async () => {
    try {
      const ordersData = await RTDBHelper.getData<Record<string, LunchOrder>>(RTDB_PATHS.lunch_orders);
      if (ordersData) {
        const today = new Date().toISOString().split('T')[0];
        const orders = Object.values(ordersData).filter(order => 
          order.createdAt.startsWith(today)
        );
        setTodayOrders(orders);
      }
    } catch (error) {
      console.error("Error loading today's orders:", error);
    }
  };

  const saveMenuItem = async () => {
    if (!formData.name || !formData.description || formData.price <= 0) {
      toast({
        title: "Error",
        description: "Complete todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (editingItem) {
        // Update existing item
        const updatedItem = { ...editingItem, ...formData };
        await RTDBHelper.setData(`${RTDB_PATHS.lunch_menu}/${editingItem.id}`, updatedItem);
        toast({
          title: "Producto actualizado",
          description: "El producto ha sido actualizado correctamente"
        });
      } else {
        // Create new item
        const newItem = {
          ...formData,
          isActive: formData.isActive ?? true,
          dailyLimit: formData.dailyLimit ?? 0
        };
        await RTDBHelper.pushData(RTDB_PATHS.lunch_menu, newItem);
        toast({
          title: "Producto creado",
          description: "El producto ha sido creado correctamente"
        });
      }
      
      resetForm();
      loadMenu();
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast({
        title: "Error",
        description: "Error al guardar el producto",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!confirm("¿Está seguro de eliminar este producto?")) return;

    setLoading(true);
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.lunch_menu}/${itemId}`);
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente"
      });
      loadMenu();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      toast({
        title: "Error",
        description: "Error al eliminar el producto",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await RTDBHelper.setData(RTDB_PATHS.lunch_settings, settings);
      toast({
        title: "Configuración guardada",
        description: "Los parámetros han sido actualizados correctamente"
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Error al guardar la configuración",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const markAsDelivered = async (orderId: string) => {
    setLoading(true);
    try {
      const updatedOrder = {
        ...todayOrders.find(o => o.id === orderId)!,
        status: "delivered" as const,
        deliveryAt: new Date().toISOString()
      };
      
      await RTDBHelper.setData(`${RTDB_PATHS.lunch_orders}/${orderId}`, updatedOrder);
      toast({
        title: "Pedido entregado",
        description: "El pedido ha sido marcado como entregado"
      });
      loadTodayOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Error al actualizar el pedido",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const startEdit = (item: LunchMenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      image: "",
      isActive: true,
      category: "",
      dailyLimit: 0
    });
    setShowForm(false);
  };

  const printOrders = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const ordersHtml = `
      <html>
        <head>
          <title>Pedidos del Día - ${new Date().toLocaleDateString('es-PE')}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 { 
              font-size: 28px; 
              margin: 0 0 10px 0;
              color: #333;
            }
            .header p { 
              font-size: 16px; 
              margin: 0;
              color: #666;
            }
            .order { 
              border: 1px solid #ddd; 
              margin-bottom: 20px; 
              padding: 15px;
              border-radius: 8px;
              background: #f9f9f9;
            }
            .order-header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 1px solid #ddd;
            }
            .student-info { 
              font-size: 18px; 
              font-weight: bold;
              color: #333;
            }
            .status { 
              padding: 4px 12px; 
              border-radius: 20px; 
              font-size: 14px;
              font-weight: bold;
            }
            .status.pending { background: #fff3cd; color: #856404; }
            .status.preparing { background: #d1ecf1; color: #0c5460; }
            .status.delivered { background: #d4edda; color: #155724; }
            .items { 
              margin: 10px 0;
            }
            .item { 
              font-size: 16px; 
              margin: 5px 0;
              padding: 5px 0;
            }
            .note { 
              font-style: italic; 
              color: #666;
              margin-top: 8px;
              font-size: 14px;
            }
            .total { 
              font-weight: bold; 
              font-size: 18px;
              text-align: right;
              margin-top: 10px;
              color: #333;
            }
            .summary {
              margin-top: 30px;
              padding: 15px;
              background: #e9ecef;
              border-radius: 8px;
            }
            @media print {
              .order { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>COMANDA DE ALMUERZOS</h1>
            <p>Fecha: ${new Date().toLocaleDateString('es-PE', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
            <p>Hora de impresión: ${new Date().toLocaleTimeString('es-PE')}</p>
          </div>
          
          ${todayOrders.map(order => `
            <div class="order">
              <div class="order-header">
                <div class="student-info">${order.clientName} (${order.code})</div>
                <div class="status ${order.status}">
                  ${order.status === 'pending' ? 'PENDIENTE' : 
                    order.status === 'preparing' ? 'PREPARANDO' : 
                    order.status === 'delivered' ? 'ENTREGADO' : 'CANCELADO'}
                </div>
              </div>
              
              <div class="items">
                <strong>Productos:</strong>
                ${order.items.map(item => `
                  <div class="item">• ${item.qty}x ${item.name}</div>
                `).join('')}
              </div>
              
              ${order.note ? `<div class="note"><strong>Observaciones:</strong> ${order.note}</div>` : ''}
              
              <div class="total">Total: S/ ${order.total.toFixed(2)}</div>
            </div>
          `).join('')}
          
          <div class="summary">
            <h3>Resumen del día</h3>
            <p><strong>Total de pedidos:</strong> ${todayOrders.length}</p>
            <p><strong>Pendientes:</strong> ${todayOrders.filter(o => o.status === 'pending').length}</p>
            <p><strong>En preparación:</strong> ${todayOrders.filter(o => o.status === 'preparing').length}</p>
            <p><strong>Entregados:</strong> ${todayOrders.filter(o => o.status === 'delivered').length}</p>
            <p><strong>Total en ventas:</strong> S/ ${todayOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(ordersHtml);
    printWindow.document.close();
    printWindow.print();
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Acceso Denegado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Solo administradores pueden acceder a este módulo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            {onBack && (
              <div className="flex justify-start mb-4">
                <Button
                  variant="ghost"
                  onClick={onBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Dashboard
                </Button>
              </div>
            )}
            <CardTitle className="text-3xl font-bold text-primary">
              Administración de Almuerzos
            </CardTitle>
            <p className="text-muted-foreground">Gestionar menú, configuración y pedidos</p>
          </CardHeader>
        </Card>

        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pedidos ({todayOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* Catalog Tab */}
          <TabsContent value="catalog" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Productos del Menú</CardTitle>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </CardHeader>
              <CardContent>
                {showForm && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>
                        {editingItem ? "Editar Producto" : "Nuevo Producto"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Nombre del producto"
                          value={formData.name || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                          placeholder="Categoría"
                          value={formData.category || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        />
                      </div>
                      
                      <Textarea
                        placeholder="Descripción"
                        value={formData.description || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          type="number"
                          placeholder="Precio (S/)"
                          value={formData.price || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        />
                        <Input
                          type="number"
                          placeholder="Límite diario (0 = sin límite)"
                          value={formData.dailyLimit || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, dailyLimit: parseInt(e.target.value) || 0 }))}
                        />
                        <Input
                          placeholder="URL de imagen (opcional)"
                          value={formData.image || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.isActive ?? true}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                        />
                        <span>Producto activo</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={saveMenuItem} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          {editingItem ? "Actualizar" : "Guardar"}
                        </Button>
                        <Button variant="outline" onClick={resetForm}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menu.map((item) => (
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
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold">{item.name}</h3>
                              <Badge variant={item.isActive ? "default" : "secondary"}>
                                {item.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.description}
                            </p>
                            <p className="font-bold text-primary mb-2">
                              S/ {item.price.toFixed(2)}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(item)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteMenuItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
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
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Módulo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hora límite para pedidos</label>
                    <Input
                      type="time"
                      value={settings.cutoffTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, cutoffTime: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Minutos para editar después de crear</label>
                    <Input
                      type="number"
                      value={settings.allowEditsMinutes}
                      onChange={(e) => setSettings(prev => ({ ...prev, allowEditsMinutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.showPrices}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showPrices: checked }))}
                    />
                    <span>Mostrar precios a los padres</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.deliveryTracking}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, deliveryTracking: checked }))}
                    />
                    <span>Mostrar estado de entrega</span>
                  </div>
                </div>
                
                <Button onClick={saveSettings} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  Pedidos del Día - {new Date().toLocaleDateString('es-PE')}
                </CardTitle>
                <Button onClick={printOrders} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir Comanda
                </Button>
              </CardHeader>
              <CardContent>
                {todayOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay pedidos registrados para hoy
                  </p>
                ) : (
                  <div className="space-y-4">
                    {todayOrders.map((order) => (
                      <Card key={order.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{order.clientName}</h3>
                              <p className="text-sm text-muted-foreground">Código: {order.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                order.status === "delivered" ? "default" :
                                order.status === "preparing" ? "secondary" :
                                "outline"
                              }>
                                {order.status === "pending" && "Pendiente"}
                                {order.status === "preparing" && "Preparando"}
                                {order.status === "delivered" && "Entregado"}
                                {order.status === "canceled" && "Cancelado"}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(order.createdAt).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <p className="text-sm font-medium">Productos:</p>
                            {order.items.map((item, index) => (
                              <p key={index} className="text-sm text-muted-foreground ml-4">
                                • {item.qty}x {item.name} - S/ {(item.price * item.qty).toFixed(2)}
                              </p>
                            ))}
                          </div>
                          
                          {order.note && (
                            <div className="mb-3">
                              <p className="text-sm font-medium">Observaciones:</p>
                              <p className="text-sm text-muted-foreground ml-4">{order.note}</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <p className="font-bold">Total: S/ {order.total.toFixed(2)}</p>
                            {order.status !== "delivered" && order.status !== "canceled" && (
                              <Button
                                size="sm"
                                onClick={() => markAsDelivered(order.id)}
                                disabled={loading}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Marcar Entregado
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LunchAdmin;
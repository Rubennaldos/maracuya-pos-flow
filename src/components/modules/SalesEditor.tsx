// Sale editor component for editing existing sales
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { RTDBHelper } from '@/lib/rt';
import { RTDB_PATHS } from '@/lib/rtdb';
import { Client } from '@/types/client';
import { Product } from '@/types/product';
import { AlertTriangle, Save, Plus, Trash2, Edit, Check, Search, ShoppingCart, User2 } from 'lucide-react';

interface Sale {
  id: string;
  correlative: string;
  date: string;
  client: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    isKitchen: boolean;
  }>;
  paymentMethod: string;
  total: number;
  status: string;
  notes?: string;
  hasKitchenOrder?: boolean;
}

interface SalesEditorProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedSale: Sale) => void;
}

export const SalesEditor = ({ sale, isOpen, onClose, onSave }: SalesEditorProps) => {
  const [editedSale, setEditedSale] = useState<Sale | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Client search
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  
  // Product search for adding items
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Initialize edited sale when dialog opens
  useEffect(() => {
    if (sale && isOpen) {
      setEditedSale({ 
        ...sale,
        items: sale.items.map(item => ({ ...item })) // Deep copy items
      });
      setErrors([]);
      loadClients();
      loadProducts();
    }
  }, [sale, isOpen]);

  const loadClients = async () => {
    try {
      const clientsData = await RTDBHelper.getData<Record<string, Client>>(RTDB_PATHS.clients);
      if (clientsData) {
        const clientsList = Object.entries(clientsData)
          .map(([id, client]) => ({ ...client, id }))
          .filter(client => client.active !== false);
        setClients(clientsList);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await RTDBHelper.getData<Record<string, Product>>(RTDB_PATHS.products);
      if (productsData) {
        const productsList = Object.entries(productsData)
          .map(([id, product]) => ({ ...product, id }))
          .filter(product => product.active !== false);
        setProducts(productsList);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  if (!editedSale) return null;

  const calculateTotal = () => {
    return editedSale.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setEditedSale(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], quantity };
      const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      return { ...prev, items: newItems, total: newTotal };
    });
  };

  const updateItemPrice = (index: number, price: number) => {
    if (price < 0) return;
    setEditedSale(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], price };
      const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      return { ...prev, items: newItems, total: newTotal };
    });
  };

  const removeItem = (index: number) => {
    setEditedSale(prev => {
      if (!prev) return null;
      const newItems = prev.items.filter((_, idx) => idx !== index);
      const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      return { ...prev, items: newItems, total: newTotal };
    });
  };

  const addProduct = (product: Product) => {
    setEditedSale(prev => {
      if (!prev) return null;
      const newItem = {
        id: `${Date.now()}-${product.id}`,
        name: product.name,
        quantity: 1,
        price: product.price,
        isKitchen: product.isKitchen || false
      };
      const newItems = [...prev.items, newItem];
      const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      return { ...prev, items: newItems, total: newTotal };
    });
    setProductSearchOpen(false);
    setProductSearchTerm('');
  };

  const selectClient = (client: Client) => {
    setEditedSale(prev => prev ? {
      ...prev,
      client: { id: client.id, name: client.fullName }
    } : null);
    setClientSearchOpen(false);
    setClientSearchTerm('');
  };

  const filteredClients = clients.filter(client =>
    client.fullName.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    client.code?.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.code?.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const validateAndSave = () => {
    const newErrors: string[] = [];

    if (!editedSale.client.name.trim()) {
      newErrors.push('El nombre del cliente es obligatorio');
    }

    if (editedSale.items.length === 0) {
      newErrors.push('Debe haber al menos un producto en la venta');
    }

    if (editedSale.total <= 0) {
      newErrors.push('El total debe ser mayor que 0');
    }

    setErrors(newErrors);

    if (newErrors.length === 0) {
      onSave(editedSale);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="w-5 h-5" />
            <span>Editar Venta - {editedSale.correlative}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sale Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Correlativo</Label>
              <Input value={editedSale.correlative} disabled />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input value={new Date(editedSale.date).toLocaleString()} disabled />
            </div>
          </div>

          {/* Client Search */}
          <div className="space-y-2">
            <Label className="flex items-center space-x-2">
              <User2 className="w-4 h-4" />
              <span>Cliente</span>
            </Label>
            <div className="flex space-x-2">
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    <Search className="w-4 h-4 mr-2" />
                    {editedSale.client.name || "Seleccionar cliente..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar cliente..." 
                      value={clientSearchTerm}
                      onValueChange={setClientSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      {filteredClients.map((client) => (
                        <CommandItem
                          key={client.id}
                          onSelect={() => selectClient(client)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{client.fullName}</span>
                            {client.code && (
                              <span className="text-xs text-muted-foreground">Código: {client.code}</span>
                            )}
                            {client.grade && client.classroom && (
                              <span className="text-xs text-muted-foreground">
                                {client.grade} - {client.classroom}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                value={editedSale.client.name}
                onChange={(e) => setEditedSale(prev => prev ? {
                  ...prev,
                  client: { ...prev.client, name: e.target.value }
                } : null)}
                placeholder="O escribir nombre manualmente..."
                className="flex-1"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label>Método de Pago</Label>
            <Select
              value={editedSale.paymentMethod}
              onValueChange={(value) => setEditedSale(prev => prev ? {
                ...prev,
                paymentMethod: value
              } : null)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="yape">Yape</SelectItem>
                <SelectItem value="plin">Plin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>Productos</span>
              </Label>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Producto
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar producto..." 
                      value={productSearchTerm}
                      onValueChange={setProductSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron productos.</CommandEmpty>
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          onSelect={() => addProduct(product)}
                          className="cursor-pointer"
                        >
                          <div className="flex justify-between items-center w-full">
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              {product.code && (
                                <span className="text-xs text-muted-foreground">Código: {product.code}</span>
                              )}
                            </div>
                            <span className="font-semibold">S/ {product.price.toFixed(2)}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              {editedSale.items.map((item, index) => (
                <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{item.name}</span>
                      {item.isKitchen && (
                        <Badge variant="secondary" className="text-xs">Cocina</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Label className="text-xs">Cantidad:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                      className="w-20 text-center"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Label className="text-xs">Precio:</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                      className="w-24 text-center"
                    />
                  </div>
                  
                  <div className="text-right min-w-[80px]">
                    <span className="font-semibold">S/ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {editedSale.items.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay productos en esta venta</p>
                  <p className="text-sm">Usa el botón "Agregar Producto" para añadir items</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center text-xl font-bold">
            <span>Total:</span>
            <span className="text-primary">S/ {calculateTotal().toFixed(2)}</span>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea
              id="notes"
              value={editedSale.notes || ''}
              onChange={(e) => setEditedSale(prev => prev ? {
                ...prev,
                notes: e.target.value
              } : null)}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-4">
            <Button onClick={validateAndSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
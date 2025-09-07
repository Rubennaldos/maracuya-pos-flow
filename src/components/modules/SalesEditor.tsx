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
import { AlertTriangle, Save } from 'lucide-react';

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

  // Initialize edited sale when dialog opens
  useEffect(() => {
    if (sale && isOpen) {
      setEditedSale({ ...sale });
      setErrors([]);
    }
  }, [sale, isOpen]);

  if (!editedSale) return null;

  const hasKitchenItems = editedSale.items.some(item => item.isKitchen);
  const canEditItems = !editedSale.hasKitchenOrder;

  const validateAndSave = () => {
    const newErrors: string[] = [];

    if (!editedSale.client.name.trim()) {
      newErrors.push('El nombre del cliente es obligatorio');
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Venta - {editedSale.correlative}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warnings */}
          {hasKitchenItems && editedSale.hasKitchenOrder && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm text-warning-foreground">
                  Esta venta tiene una comanda de cocina. Solo se pueden editar datos básicos.
                </span>
              </div>
            </div>
          )}

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

          {/* Client Info */}
          <div>
            <Label htmlFor="clientName">Cliente</Label>
            <Input
              id="clientName"
              value={editedSale.client.name}
              onChange={(e) => setEditedSale(prev => prev ? {
                ...prev,
                client: { ...prev.client, name: e.target.value }
              } : null)}
              placeholder="Nombre del cliente"
            />
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
          <div>
            <Label>Productos</Label>
            <div className="space-y-2 mt-2">
              {editedSale.items.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{item.name}</span>
                    {item.isKitchen && (
                      <Badge variant="secondary" className="text-xs">Cocina</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {canEditItems ? (
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQuantity = parseInt(e.target.value) || 1;
                          setEditedSale(prev => prev ? {
                            ...prev,
                            items: prev.items.map((it, idx) => 
                              idx === index ? { ...it, quantity: newQuantity } : it
                            ),
                            total: prev.items.reduce((sum, it, idx) => 
                              sum + (idx === index ? newQuantity * it.price : it.quantity * it.price), 0
                            )
                          } : null);
                        }}
                        className="w-16"
                      />
                    ) : (
                      <span className="w-16 text-center">{item.quantity}</span>
                    )}
                    <span className="w-20 text-right">S/ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total:</span>
            <span>S/ {editedSale.total.toFixed(2)}</span>
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
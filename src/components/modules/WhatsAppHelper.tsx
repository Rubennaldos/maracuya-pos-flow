// WhatsApp helper component for AR
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageCircle, Copy, ExternalLink, Check } from 'lucide-react';

interface WhatsAppHelperProps {
  debtor: {
    id: string;
    name: string;
    phone: string;
    totalDebt: number;
    invoices: Array<{
      id: string;
      amount: number;
      date: string;
      type: string;
      products: string[];
    }>;
  };
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppHelper = ({ debtor, isOpen, onClose }: WhatsAppHelperProps) => {
  const [messageType, setMessageType] = useState<'simple' | 'detailed' | 'full'>('detailed');
  const [includeProducts, setIncludeProducts] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [useDeepLink, setUseDeepLink] = useState(true);

  const generateMessage = () => {
    const firstName = debtor.name.split(' ')[0];
    let message = `Hola ${firstName}, `;
    
    if (customMessage.trim()) {
      return customMessage;
    }
    
    switch (messageType) {
      case 'simple':
        message += `tienes una deuda pendiente de S/ ${debtor.totalDebt.toFixed(2)} en Maracuyá Villa Gratia. Por favor, acércate para realizar el pago. ¡Gracias!`;
        break;
        
      case 'detailed':
        message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
        debtor.invoices.forEach(invoice => {
          message += `📄 ${invoice.id} - S/ ${invoice.amount.toFixed(2)} (${new Date(invoice.date).toLocaleDateString()})\n`;
        });
        message += `\n💳 Total adeudado: S/ ${debtor.totalDebt.toFixed(2)}\n\nPor favor, acércate para realizar el pago. ¡Gracias!`;
        break;
        
      case 'full':
        message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
        debtor.invoices.forEach(invoice => {
          message += `📄 Boleta: ${invoice.id}\n`;
          message += `📅 Fecha: ${new Date(invoice.date).toLocaleDateString()}\n`;
          message += `💰 Monto: S/ ${invoice.amount.toFixed(2)}\n`;
          if (includeProducts && invoice.products.length > 0) {
            message += `🛒 Productos: ${invoice.products.join(', ')}\n`;
          }
          message += `\n`;
        });
        message += `💳 Total adeudado: S/ ${debtor.totalDebt.toFixed(2)}\n\nPor favor, acércate para realizar el pago. ¡Gracias!`;
        break;
    }
    
    return message;
  };

  const handleSendWhatsApp = () => {
    const message = generateMessage();
    
    if (useDeepLink) {
      // Try deep link first
      const encodedMessage = encodeURIComponent(message);
      const url = `https://wa.me/51${debtor.phone}?text=${encodedMessage}`;
      
      const newWindow = window.open(url, '_blank');
      
      // If popup was blocked, show copy option
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        setUseDeepLink(false);
      } else {
        onClose();
      }
    }
  };

  const handleCopyMessage = async () => {
    const message = generateMessage();
    
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const message = generateMessage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp - {debtor.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone display */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Teléfono:</span>
            <Badge variant="outline">+51 {debtor.phone}</Badge>
          </div>

          {/* Message type selection */}
          <div>
            <Label className="text-sm font-medium">Tipo de mensaje:</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                variant={messageType === 'simple' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageType('simple')}
              >
                Simple
              </Button>
              <Button
                variant={messageType === 'detailed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageType('detailed')}
              >
                Con Boletas
              </Button>
              <Button
                variant={messageType === 'full' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageType('full')}
              >
                Completo
              </Button>
            </div>
          </div>

          {/* Include products option */}
          {messageType === 'full' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="includeProducts"
                checked={includeProducts}
                onCheckedChange={setIncludeProducts}
              />
              <Label htmlFor="includeProducts" className="text-sm">
                Incluir detalle de productos
              </Label>
            </div>
          )}

          {/* Custom message */}
          <div>
            <Label htmlFor="customMessage" className="text-sm font-medium">
              Mensaje personalizado (opcional):
            </Label>
            <Textarea
              id="customMessage"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Escribe un mensaje personalizado o usa las plantillas..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Message preview */}
          <div>
            <Label className="text-sm font-medium">Vista previa:</Label>
            <div className="mt-1 p-3 bg-muted rounded-lg border max-h-40 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans">{message}</pre>
            </div>
          </div>

          {/* Send method toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="useDeepLink"
              checked={useDeepLink}
              onCheckedChange={setUseDeepLink}
            />
            <Label htmlFor="useDeepLink" className="text-sm">
              Abrir WhatsApp directamente
            </Label>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-4">
            {useDeepLink ? (
              <Button onClick={handleSendWhatsApp} className="flex-1">
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir WhatsApp
              </Button>
            ) : (
              <Button onClick={handleCopyMessage} className="flex-1">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Mensaje
                  </>
                )}
              </Button>
            )}
            
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>

          {!useDeepLink && (
            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
              📱 Copia el mensaje y pégalo manualmente en WhatsApp para enviarlo a +51 {debtor.phone}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
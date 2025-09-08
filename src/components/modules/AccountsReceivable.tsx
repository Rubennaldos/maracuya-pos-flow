import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Search, Users, DollarSign, Calendar,
  MessageCircle, FileText, AlertTriangle, CheckCircle,
  Clock, CreditCard
} from "lucide-react";
import { WhatsAppHelper } from "./WhatsAppHelper";
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

// Load debtors from RTDB
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

const loadDebtors = async () => {
  try {
    const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
    if (arData) {
      return Object.values(arData);
    }
    return [];
  } catch (error) {
    console.error('Error loading debtors:', error);
    return [];
  }
};

interface AccountsReceivableProps {
  onBack: () => void;
}

export const AccountsReceivable = ({ onBack }: AccountsReceivableProps) => {
  const [debtors, setDebtors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [selectedDebtorForWhatsApp, setSelectedDebtorForWhatsApp] = useState<any>(null);

  const filteredDebtors = debtors.filter(debtor =>
    debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = debtors.reduce((sum, debtor) => sum + debtor.totalDebt, 0);
  const urgentCount = debtors.filter(debtor => debtor.urgentCollection).length;

  const generateWhatsAppMessage = (debtor: any, type: 'simple' | 'detailed' | 'full') => {
    let message = `Hola ${debtor.name.split(' ')[0]}, `;
    
    if (type === 'simple') {
      message += `tienes una deuda pendiente de S/ ${debtor.totalDebt.toFixed(2)} en Maracuyá Villa Gratia. Por favor, acércate para realizar el pago.`;
    } else if (type === 'detailed') {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach(invoice => {
        message += `• ${invoice.id} - S/ ${invoice.amount.toFixed(2)} (${invoice.date})\n`;
      });
      message += `\nTotal: S/ ${debtor.totalDebt.toFixed(2)}`;
    } else {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach(invoice => {
        message += `📄 ${invoice.id} - ${invoice.date}\n`;
        message += `💰 S/ ${invoice.amount.toFixed(2)}\n`;
        message += `🛒 ${invoice.products.join(', ')}\n\n`;
      });
      message += `💳 Total adeudado: S/ ${debtor.totalDebt.toFixed(2)}`;
    }
    
    return encodeURIComponent(message);
  };

  const sendWhatsApp = (debtor: any, type: 'simple' | 'detailed' | 'full') => {
    const message = generateWhatsAppMessage(debtor, type);
    const url = `https://wa.me/51${debtor.phone}?text=${message}`;
    window.open(url, '_blank');
  };

  const processPayment = () => {
    if (!selectedDebtor || paymentAmount <= 0) return;

    // Process payment logic here
    console.log('Processing payment:', {
      debtor: selectedDebtor.id,
      amount: paymentAmount,
      method: paymentMethod,
      invoices: selectedInvoices
    });

    setShowPaymentDialog(false);
    setPaymentAmount(0);
    setSelectedInvoices([]);
  };

  const toggleUrgentCollection = (debtorId: string) => {
    setDebtors(prev => prev.map(debtor => 
      debtor.id === debtorId 
        ? { ...debtor, urgentCollection: !debtor.urgentCollection }
        : debtor
    ));
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
            <h1 className="text-2xl font-bold text-foreground">Cuentas por Cobrar</h1>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                S/ {totalDebt.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Deudores</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {debtors.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobranza Urgente</CardTitle>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {urgentCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar deudores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Debtors List */}
        <div className="space-y-4">
          {filteredDebtors.map((debtor) => (
            <Card key={debtor.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold text-lg">{debtor.name}</h3>
                      <p className="text-sm text-muted-foreground">ID: {debtor.id}</p>
                    </div>
                    {debtor.urgentCollection && (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Urgente
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      S/ {debtor.totalDebt.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {debtor.invoices.length} factura(s)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {debtor.invoices.map((invoice) => (
                    <Badge key={invoice.id} variant="outline" className="text-xs">
                      {invoice.id} - S/ {invoice.amount.toFixed(2)}
                      {invoice.type === 'VH' && <span className="ml-1 text-warning">(VH)</span>}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDebtor(debtor);
                      setShowPaymentDialog(true);
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Registrar Pago
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDebtorForWhatsApp(debtor);
                      setShowWhatsAppDialog(true);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>

                  <Button
                    variant={debtor.urgentCollection ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleUrgentCollection(debtor.id)}
                  >
                    {debtor.urgentCollection ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Desactivar Urgente
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Marcar Urgente
                      </>
                    )}
                  </Button>
                </div>

                {debtor.lastReminder && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Último recordatorio: {debtor.lastReminder}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredDebtors.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron deudores</h3>
            <p className="text-muted-foreground">Intenta con otros términos de búsqueda</p>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago - {selectedDebtor?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedDebtor && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Facturas pendientes:</p>
                <div className="space-y-2">
                  {selectedDebtor.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={invoice.id}
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoices(prev => [...prev, invoice.id]);
                          } else {
                            setSelectedInvoices(prev => prev.filter(id => id !== invoice.id));
                          }
                        }}
                      />
                      <label htmlFor={invoice.id} className="text-sm flex-1">
                        {invoice.id} - S/ {invoice.amount.toFixed(2)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Monto a Pagar</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Método de Pago</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="yape">Yape</SelectItem>
                    <SelectItem value="plin">Plin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button onClick={processPayment} className="flex-1">
                  Registrar Pago
                </Button>
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Helper Dialog */}
      {selectedDebtorForWhatsApp && (
        <WhatsAppHelper
          debtor={selectedDebtorForWhatsApp}
          isOpen={showWhatsAppDialog}
          onClose={() => {
            setShowWhatsAppDialog(false);
            setSelectedDebtorForWhatsApp(null);
          }}
        />
      )}
    </div>
  );
};
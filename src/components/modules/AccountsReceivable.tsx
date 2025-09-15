import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Search, Users, DollarSign,
  MessageCircle, AlertTriangle, CheckCircle,
  Clock, CreditCard
} from "lucide-react";
import { WhatsAppHelper } from "./WhatsAppHelper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/* =========================
   Carga robusta de deudores
   ========================= */
const loadDebtors = async () => {
  try {
    const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
    if (!arData) return [];

    // Estructura interna en memoria
    type Debtor = {
      id: string;
      name: string;
      totalDebt: number;
      invoices: { id: string; amount: number; date: string; type?: string; products: string[] }[];
      urgentCollection: boolean;
      phone?: string;
      lastReminder?: string;
    };

    const debtorMap = new Map<string, Debtor>();

    const ensureDebtor = (clientId: string, clientName?: string): Debtor => {
      if (!debtorMap.has(clientId)) {
        debtorMap.set(clientId, {
          id: clientId,
          name: clientName || clientId,
          totalDebt: 0,
          invoices: [],
          urgentCollection: false,
          phone: "999999999",
        });
      }
      return debtorMap.get(clientId)!;
    };

    // A) Formato NUEVO (agrupado por cliente)
    Object.entries(arData).forEach(([clientId, clientData]) => {
      const cData = clientData as any;
      if (cData && typeof cData === "object" && cData.entries) {
        const entries: Record<string, any> = cData.entries;
        Object.values(entries).forEach((entry: any) => {
          if (entry?.status === "pending") {
            const d = ensureDebtor(clientId, entry.clientName);
            const amount = Number(entry.amount || 0);
            d.totalDebt += amount;
            d.invoices.push({
              id: entry.correlative || entry.saleId || "SIN-ID",
              amount,
              date: entry.date ? new Date(entry.date).toLocaleDateString() : "",
              type: entry.type,
              products: Array.isArray(entry.items) ? entry.items.map((it: any) => it?.name).filter(Boolean) : [],
            });
          }
        });
      }
    });

    // B) Formato PLANO/LEGADO (entradas sueltas en el root)
    Object.entries(arData).forEach(([key, value]) => {
      const flat = value as any;
      const looksEntry =
        flat && typeof flat === "object" && flat.status && (flat.amount !== undefined) && !flat.entries;

      if (looksEntry && flat.status === "pending") {
        const clientId = flat.clientId || "varios";
        const d = ensureDebtor(clientId, flat.clientName);
        const amount = Number(flat.amount || 0);
        d.totalDebt += amount;
        d.invoices.push({
          id: flat.correlative || flat.saleId || key,
          amount,
          date: flat.date ? new Date(flat.date).toLocaleDateString() : "",
          type: flat.type,
          products: Array.isArray(flat.items) ? flat.items.map((it: any) => it?.name).filter(Boolean) : [],
        });
      }
    });

    // Devuelve array ordenado por nombre
    return Array.from(debtorMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  } catch (error) {
    console.error("Error loading debtors:", error);
    return [];
  }
};

interface AccountsReceivableProps {
  onBack: () => void;
}

export const AccountsReceivable = ({ onBack }: AccountsReceivableProps) => {
  const [debtors, setDebtors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [selectedDebtorForWhatsApp, setSelectedDebtorForWhatsApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cargar deudores al montar
  useEffect(() => {
    const fetchDebtors = async () => {
      setLoading(true);
      const data = await loadDebtors();
      setDebtors(data);
      setLoading(false);
    };
    fetchDebtors();
  }, []);

  const filteredDebtors = debtors.filter((debtor) =>
    debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = debtors.reduce((sum, d) => sum + (d.totalDebt || 0), 0);
  const urgentCount = debtors.filter((d) => d.urgentCollection).length;

  const generateWhatsAppMessage = (debtor: any, type: "simple" | "detailed" | "full") => {
    let message = `Hola ${debtor.name.split(" ")[0]}, `;

    if (type === "simple") {
      message += `tienes una deuda pendiente de S/ ${debtor.totalDebt.toFixed(2)} en Maracuyá Villa Gratia. Por favor, acércate para realizar el pago.`;
    } else if (type === "detailed") {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach((inv: any) => {
        message += `• ${inv.id} - S/ ${inv.amount.toFixed(2)} (${inv.date})\n`;
      });
      message += `\nTotal: S/ ${debtor.totalDebt.toFixed(2)}`;
    } else {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach((inv: any) => {
        message += `📄 ${inv.id} - ${inv.date}\n`;
        message += `💰 S/ ${inv.amount.toFixed(2)}\n`;
        message += `🛒 ${inv.products.join(", ")}\n\n`;
      });
      message += `💳 Total adeudado: S/ ${debtor.totalDebt.toFixed(2)}`;
    }

    return encodeURIComponent(message);
  };

  const sendWhatsApp = (debtor: any, type: "simple" | "detailed" | "full") => {
    const message = generateWhatsAppMessage(debtor, type);
    const url = `https://wa.me/51${debtor.phone}?text=${message}`;
    window.open(url, "_blank");
  };

  const processPayment = () => {
    if (!selectedDebtor || paymentAmount <= 0) return;

    // Aquí iría la lógica de registrar el pago en RTDB
    console.log("Processing payment:", {
      debtor: selectedDebtor.id,
      amount: paymentAmount,
      method: paymentMethod,
      invoices: selectedInvoices,
    });

    setShowPaymentDialog(false);
    setPaymentAmount(0);
    setSelectedInvoices([]);
  };

  const toggleUrgentCollection = (debtorId: string) => {
    setDebtors((prev) =>
      prev.map((d) =>
        d.id === debtorId ? { ...d, urgentCollection: !d.urgentCollection } : d
      )
    );
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
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">S/ {totalDebt.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Deudores</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtors.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobranza Urgente</CardTitle>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{urgentCount}</div>
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

        {/* Debtors list */}
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
                    <p className="text-2xl font-bold text-primary">S/ {debtor.totalDebt.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {debtor.invoices.length} factura(s)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {debtor.invoices.map((inv: any) => (
                    <Badge key={inv.id} variant="outline" className="text-xs">
                      {inv.id} - S/ {inv.amount.toFixed(2)}
                      {inv.type === "VH" && <span className="ml-1 text-warning">(VH)</span>}
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

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando deudores...</p>
          </div>
        ) : filteredDebtors.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No se encontraron deudores
            </h3>
            <p className="text-muted-foreground">
              {debtors.length === 0
                ? "No hay ventas a crédito registradas"
                : "Intenta con otros términos de búsqueda"}
            </p>
          </div>
        ) : null}
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
                  {selectedDebtor.invoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={invoice.id}
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoices((prev) => [...prev, invoice.id]);
                          } else {
                            setSelectedInvoices((prev) => prev.filter((id) => id !== invoice.id));
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

      {/* WhatsApp Helper */}
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

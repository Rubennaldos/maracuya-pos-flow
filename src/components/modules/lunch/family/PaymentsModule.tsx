import React, { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Upload,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  FileText,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/useImageUpload";
import { normalizePhone, buildWaUrl, openWhatsAppNow } from "./openWhatsApp";
import paymentReferenceImage from "@/assets/payment-reference.png";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  correlative: string;
  date: string;
  amount: number;
  products: string;
  status?: string;
}

interface ClientDebt {
  clientId: string;
  clientName: string;
  totalDebt: number;
  invoices: Invoice[];
}

interface PaymentsModuleProps {
  clientId: string;
  clientName: string;
  whatsappPhone?: string;
}

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function PaymentsModule({
  clientId,
  clientName,
  whatsappPhone,
}: PaymentsModuleProps) {
  const [loading, setLoading] = useState(true);
  const [debtInfo, setDebtInfo] = useState<ClientDebt | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { uploadImage, isUploading } = useImageUpload();

  // Cargar deuda del cliente
  useEffect(() => {
    loadClientDebt();
  }, [clientId]);

  const loadClientDebt = async () => {
    setLoading(true);
    try {
      const arData = await RTDBHelper.getData<any>(
        `${RTDB_PATHS.accounts_receivable}/${clientId}`
      );

      if (!arData || !arData.entries) {
        setDebtInfo({
          clientId,
          clientName,
          totalDebt: 0,
          invoices: [],
        });
        return;
      }

      const invoices: Invoice[] = [];
      let totalDebt = 0;

      Object.entries(arData.entries).forEach(([entryId, entry]: [string, any]) => {
        if (entry && entry.status !== "paid") {
          invoices.push({
            id: entryId,
            correlative: entry.invoiceId || entryId,
            date: entry.date || "",
            amount: entry.amount || 0,
            products: entry.products || "Sin detalles",
            status: entry.status || "pending",
          });
          totalDebt += entry.amount || 0;
        }
      });

      // Ordenar por fecha descendente
      invoices.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });

      setDebtInfo({
        clientId,
        clientName,
        totalDebt,
        invoices,
      });
    } catch (error) {
      console.error("Error cargando deuda:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de deuda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Manejo de selección de facturas
  const handleSelectInvoice = (invoiceId: string, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedInvoices);

    // Shift+Click para rango
    if (event.shiftKey && lastSelectedIndex !== null && debtInfo) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(debtInfo.invoices[i].id);
      }
    } else {
      if (newSelected.has(invoiceId)) {
        newSelected.delete(invoiceId);
      } else {
        newSelected.add(invoiceId);
      }
    }

    setSelectedInvoices(newSelected);
    setLastSelectedIndex(index);
    updatePaymentAmount(newSelected);
  };

  const handleSelectAll = () => {
    if (!debtInfo) return;
    const allIds = new Set(debtInfo.invoices.map((inv) => inv.id));
    setSelectedInvoices(allIds);
    updatePaymentAmount(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedInvoices(new Set());
    setPaymentAmount(0);
    setCustomAmount("");
  };

  const updatePaymentAmount = (selected: Set<string>) => {
    if (!debtInfo) return;
    const total = debtInfo.invoices
      .filter((inv) => selected.has(inv.id))
      .reduce((sum, inv) => sum + inv.amount, 0);
    setPaymentAmount(total);
  };

  // Subir comprobante
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const webpDataUrl = await uploadImage(file);
      setPaymentProof(webpDataUrl);
      toast({
        title: "Comprobante cargado",
        description: "La imagen ha sido procesada correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cargar el comprobante",
        variant: "destructive",
      });
    }
  };

  // Procesar pago
  const handlePayment = (isFullPayment: boolean) => {
    if (selectedInvoices.size === 0) {
      toast({
        title: "Selecciona facturas",
        description: "Debes seleccionar al menos una factura para pagar",
        variant: "destructive",
      });
      return;
    }

    if (!isFullPayment) {
      const amount = parseFloat(customAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Monto inválido",
          description: "Ingresa un monto válido para abonar",
          variant: "destructive",
        });
        return;
      }
      setPaymentAmount(amount);
    }

    setShowConfirmDialog(true);
  };

  // Confirmar y enviar
  const confirmPayment = async () => {
    if (!paymentProof) {
      toast({
        title: "Comprobante requerido",
        description: "Debes adjuntar un comprobante de pago",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const selectedInvoicesList = debtInfo?.invoices.filter((inv) =>
        selectedInvoices.has(inv.id)
      ) || [];

      // Crear registro de pago pendiente
      const paymentId = crypto.randomUUID();
      const paymentData = {
        id: paymentId,
        clientId,
        clientName,
        amount: paymentAmount,
        invoices: selectedInvoicesList.map((inv) => ({
          id: inv.id,
          correlative: inv.correlative,
          amount: inv.amount,
        })),
        paymentProof,
        status: "pending_review",
        createdAt: Date.now(),
        date: format(new Date(), "yyyy-MM-dd"),
      };

      await RTDBHelper.setData(`family_payments/${paymentId}`, paymentData);

      // Enviar por WhatsApp
      await sendWhatsAppNotification(selectedInvoicesList);

      toast({
        title: "Pago enviado",
        description: "Tu pago está en revisión. Recibirás confirmación pronto.",
      });

      // Limpiar estado
      setShowConfirmDialog(false);
      setSelectedInvoices(new Set());
      setPaymentAmount(0);
      setCustomAmount("");
      setPaymentProof(null);
      
      // Recargar deuda
      await loadClientDebt();
    } catch (error) {
      console.error("Error procesando pago:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar el pago. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar notificación por WhatsApp
  const sendWhatsAppNotification = async (invoices: Invoice[]) => {
    const phoneDigits = normalizePhone(whatsappPhone || "");
    if (!phoneDigits) {
      toast({
        title: "WhatsApp no configurado",
        description: "No se puede enviar la notificación",
        variant: "destructive",
      });
      return;
    }

    const invoiceDetails = invoices
      .map((inv) => `• ${inv.correlative} - ${PEN(inv.amount)} (${inv.date})`)
      .join("\n");

    const message = `💳 *PAGO DE DEUDA - PORTAL FAMILIAS*\n\n` +
      `👤 Cliente: ${clientName} (${clientId})\n` +
      `💰 Monto pagado: ${PEN(paymentAmount)}\n\n` +
      `📋 *Facturas incluidas:*\n${invoiceDetails}\n\n` +
      `📅 Fecha: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}\n\n` +
      `✅ Comprobante adjunto en sistema\n` +
      `⏳ Estado: Pendiente de revisión`;

    const url = buildWaUrl(phoneDigits, message);
    openWhatsAppNow(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Cargando información...</div>
        </CardContent>
      </Card>
    );
  }

  if (!debtInfo || debtInfo.invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sin Deudas Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            ¡Excelente! No tienes deudas pendientes en este momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Mis Pagos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Gestiona tus pagos y deudas pendientes
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Alerta de advertencia */}
          <Alert className="border-amber-500 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong>ATENCIÓN PADRE DE FAMILIA:</strong>
              <br />
              Usted está a punto de cancelar su deuda hasta la actualidad, pero{" "}
              <strong>el personal de ventas puede tener montos sin pasar aún en su cuaderno de ventas</strong>.
              Su pago será confirmado muy pronto.
              <br />
              <br />
              Por favor, comuníquese al{" "}
              <a
                href={`https://wa.me/${normalizePhone(whatsappPhone || "")}`}
                className="underline font-semibold"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>{" "}
              para pedir más información.
            </AlertDescription>
          </Alert>

          {/* Resumen de deuda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Deuda Total</div>
                <div className="text-2xl font-bold text-red-600">
                  {PEN(debtInfo.totalDebt)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Monto a Pagar</div>
                <div className="text-2xl font-bold text-green-600">
                  {PEN(paymentAmount)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Botones de selección */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Seleccionar Todo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Deseleccionar
            </Button>
          </div>

          {/* Tabla de facturas */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Correlativo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtInfo.invoices.map((invoice, index) => (
                  <TableRow
                    key={invoice.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      selectedInvoices.has(invoice.id) && "bg-blue-50"
                    )}
                    onClick={(e) => handleSelectInvoice(invoice.id, index, e)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedInvoices.has(invoice.id)}
                        onCheckedChange={() => {}}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{invoice.correlative}</TableCell>
                    <TableCell>{format(new Date(invoice.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="max-w-xs truncate">{invoice.products}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {PEN(invoice.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Información de referencia de pago */}
          <Card className="border-blue-500 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base">Información de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={paymentReferenceImage}
                alt="Información de pago"
                className="w-full rounded-lg shadow-md"
              />
            </CardContent>
          </Card>

          {/* Opciones de pago */}
          <div className="space-y-4">
            {/* Abonar monto personalizado */}
            <div className="space-y-2">
              <Label htmlFor="customAmount">Abonar monto personalizado</Label>
              <div className="flex gap-2">
                <Input
                  id="customAmount"
                  type="number"
                  placeholder="Ingresa el monto a abonar"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Button
                  onClick={() => handlePayment(false)}
                  disabled={selectedInvoices.size === 0 || !customAmount}
                  variant="outline"
                >
                  Abonar
                </Button>
              </div>
            </div>

            {/* Pagar completo */}
            <Button
              onClick={() => handlePayment(true)}
              disabled={selectedInvoices.size === 0}
              className="w-full"
              size="lg"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Pagar Completo - {PEN(paymentAmount)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>
              Revisa los detalles de tu pago antes de confirmar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Cliente:</span>
                <span className="font-semibold">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Facturas seleccionadas:</span>
                <span className="font-semibold">{selectedInvoices.size}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span>Monto a pagar:</span>
                <span className="font-bold text-green-600">{PEN(paymentAmount)}</span>
              </div>
            </div>

            {/* Comprobante de pago - OBLIGATORIO */}
            <div className="space-y-2">
              <Label htmlFor="paymentProof" className="text-base font-semibold">
                Comprobante de Pago <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Es obligatorio adjuntar tu comprobante de pago (captura o foto)
              </p>
              
              <div className="border-2 border-dashed rounded-lg p-4">
                {paymentProof ? (
                  <div className="space-y-2">
                    <img
                      src={paymentProof}
                      alt="Comprobante"
                      className="w-full max-h-64 object-contain rounded"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentProof(null)}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cambiar comprobante
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <Label
                      htmlFor="fileUpload"
                      className="cursor-pointer text-blue-600 hover:underline"
                    >
                      {isUploading ? "Procesando..." : "Haz click para subir comprobante"}
                    </Label>
                    <Input
                      id="fileUpload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Formatos: JPG, PNG, WEBP (Máx. 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Advertencia final */}
            <Alert className="border-amber-500 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                Tu pago pasará a <strong>estado de revisión</strong>. Recibirás confirmación cuando
                sea validado por el equipo administrativo.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmPayment}
              disabled={!paymentProof || submitting}
              className="gap-2"
            >
              {submitting ? (
                "Enviando..."
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" />
                  Confirmar y Enviar a WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

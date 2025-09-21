// AccountsReceivable.tsx (corregido completo con PDF: subtotales + paginación)
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Search, Users, DollarSign, MessageCircle, AlertTriangle,
  CheckCircle, Clock, CreditCard, FileText, Receipt, Download,
  Calendar as CalendarIcon
} from "lucide-react";
import { WhatsAppHelper } from "./WhatsAppHelper";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parse, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // <- import correcto

import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/* ===== Helpers para mostrar nombre de vendedor legible ===== */
const looksLikeUid = (s: any) =>
  typeof s === "string" && /^[A-Za-z0-9_-]{22,36}$/.test(s);

async function resolveVendorName(vendorField: string): Promise<string> {
  if (!looksLikeUid(vendorField)) return vendorField || "Sistema";
  const pathsToTry = [
    `users/${vendorField}/profile/displayName`,
    `users/${vendorField}/displayName`,
    `users/${vendorField}/name`,
    `users/${vendorField}/email`,
  ];
  for (const p of pathsToTry) {
    const v = await RTDBHelper.getData<string>(p).catch(() => null);
    if (v && String(v).trim()) return String(v);
  }
  return "Usuario";
}

/* ===== Helper de fechas seguro (evita corrimiento por UTC) ===== */
const toLocalDateSafe = (d: string | Date): Date => {
  if (d instanceof Date) return d;
  if (!d) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const local = parse(d, "yyyy-MM-dd", new Date());
    return isValid(local) ? local : new Date();
  }
  const iso = parseISO(d);
  return isValid(iso) ? iso : new Date();
};
const fmtDMY = (d: string | Date) => format(toLocalDateSafe(d), "dd/MM/yyyy");

/* =========================
   Carga robusta de deudores
   ========================= */
const loadDebtors = async () => {
  try {
    const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
    if (!arData) return [];

    type Debtor = {
      id: string;
      name: string;
      totalDebt: number;
      invoices: {
        id: string;
        amount: number;
        date: string;
        dateSort: number;
        type?: string;
        products: string[];
      }[];
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

            const dObj = toLocalDateSafe(entry.date);
            d.invoices.push({
              id: entry.correlative || entry.saleId || "SIN-ID",
              amount,
              date: format(dObj, "dd/MM/yyyy"),
              dateSort: dObj.getTime(),
              type: entry.type,
              products: Array.isArray(entry.items)
                ? entry.items.map((it: any) => it?.name).filter(Boolean)
                : [],
            });
          }
        });
      }
    });

    // B) Formato PLANO/LEGADO
    Object.entries(arData).forEach(([key, value]) => {
      const flat = value as any;
      const looksEntry =
        flat && typeof flat === "object" && flat.status && (flat.amount !== undefined) && !flat.entries;

      if (looksEntry && flat.status === "pending") {
        const clientId = flat.clientId || "varios";
        const d = ensureDebtor(clientId, flat.clientName);
        const amount = Number(flat.amount || 0);
        d.totalDebt += amount;

        const dObj = toLocalDateSafe(flat.date);
        d.invoices.push({
          id: flat.correlative || flat.saleId || key,
          amount,
          date: format(dObj, "dd/MM/yyyy"),
          dateSort: dObj.getTime(),
          type: flat.type,
          products: Array.isArray(flat.items)
            ? flat.items.map((it: any) => it?.name).filter(Boolean)
            : [],
        });
      }
    });

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
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPaidTerm, setSearchPaidTerm] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [showSalesDetailDialog, setShowSalesDetailDialog] = useState(false);
  const [showCXCDialog, setShowCXCDialog] = useState(false);
  const [selectedDebtorForWhatsApp, setSelectedDebtorForWhatsApp] = useState<any>(null);
  const [selectedDebtorForDetail, setSelectedDebtorForDetail] = useState<any>(null);
  const [salesDetailData, setSalesDetailData] = useState<any[]>([]);
  const [filteredSalesDetail, setFilteredSalesDetail] = useState<any[]>([]);
  const [salesSearchTerm, setSalesSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    const fetchDebtors = async () => {
      setLoading(true);
      const data = await loadDebtors();
      setDebtors(data);
      setLoading(false);
    };
    fetchDebtors();
  }, []);

  useEffect(() => {
    let filtered = salesDetailData;

    if (salesSearchTerm) {
      filtered = filtered.filter(item =>
        (item.correlative || "").toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
        (item.productName || "").toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
        (item.sellerShown || item.sellerRaw || "").toLowerCase().includes(salesSearchTerm.toLowerCase())
      );
    }

    if (dateFrom || dateTo) {
      filtered = filtered.filter(item => {
        const itemDate = toLocalDateSafe(item.date);
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo && itemDate > dateTo) return false;
        return true;
      });
    }

    setFilteredSalesDetail(filtered);
  }, [salesDetailData, salesSearchTerm, dateFrom, dateTo]);

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

  /* ===== Detalle de ventas: resuelve nombre del vendedor si viene UID ===== */
  const loadSalesDetail = async (clientId: string) => {
    try {
      const salesData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      const historicalData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.historical_sales);
      const allSales = { ...salesData, ...historicalData };
      const clientSales: any[] = [];

      Object.entries(allSales || {}).forEach(([saleId, sale]: [string, any]) => {
        if (sale?.clientId === clientId || sale?.client?.id === clientId) {
          const items = Array.isArray(sale.items) ? sale.items : [];
          const sellerRaw =
            sale.userName || sale.seller || sale.user || sale.cashier || "Sistema";

          items.forEach((item: any) => {
            clientSales.push({
              saleId,
              correlative: sale.correlative || saleId,
              date: sale.date || sale.createdAt,
              sellerRaw,
              clientName: sale.client?.name || sale.clientName || "Cliente",
              productName: item.name || "Producto",
              quantity: item.quantity || 1,
              price: item.price || 0,
              total: (item.quantity || 1) * (item.price || 0),
              paymentMethod: sale.paymentMethod || "efectivo",
            });
          });
        }
      });

      const withSellerName = await Promise.all(
        clientSales.map(async (r) => ({
          ...r,
          sellerShown: await resolveVendorName(r.sellerRaw),
        }))
      );

      return withSellerName.sort(
        (a, b) => toLocalDateSafe(b.date).getTime() - toLocalDateSafe(a.date).getTime()
      );
    } catch (error) {
      console.error("Error loading sales detail:", error);
      return [];
    }
  };

  const exportToExcel = (data: any[], filename: string) => {
    const exportData = data.map(item => ({
      'Correlativo': item.correlative,
      'Fecha': format(toLocalDateSafe(item.date), "dd/MM/yyyy"),
      'Vendedor': item.sellerShown,
      'Producto': item.productName,
      'Cantidad': item.quantity,
      'Precio': `S/ ${Number(item.price || 0).toFixed(2)}`,
      'Total': `S/ ${Number(item.total || 0).toFixed(2)}`
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle de Ventas");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  /* ========= PDF con subtotales por día + paginación ========= */
  const exportToPDF = (data: any[], clientName: string) => {
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Encabezado
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("MARACUYÁ VILLA GRATIA", pageW / 2, 20, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Detalle de Ventas - ${clientName}`, pageW / 2, 35, { align: "center" });

      doc.setFontSize(10);
      doc.text(
        `Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
        pageW / 2,
        45,
        { align: "center" }
      );

      // Rango de fechas (opcional)
      let cursorY = 55;
      if (dateFrom || dateTo) {
        const fromDate = dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Inicio";
        const toDate = dateTo ? format(dateTo, "dd/MM/yyyy") : "Actual";
        doc.text(`Período: ${fromDate} - ${toDate}`, pageW / 2, 55, { align: "center" });
        cursorY = 65;
      }

      // Agrupar por día
      const groups = new Map<string, any[]>();
      data.forEach((item) => {
        const key = format(toLocalDateSafe(item.date), "dd/MM/yyyy");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      });

      // Orden por fecha ascendente
      const entries = Array.from(groups.entries()).sort(
        ([a], [b]) =>
          toLocalDateSafe(a).getTime() - toLocalDateSafe(b).getTime()
      );

      // Color cabecera de tabla
      const headStyles = { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" as const };

      let grandTotal = 0;

      for (const [day, items] of entries) {
        // Título de día
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(day, 20, cursorY);
        cursorY += 4;

        // Filas
        const body = items.map((item: any) => {
          const rowTotal = Number(item.total || 0);
          grandTotal += rowTotal;
          return [
            item.correlative || "",
            format(toLocalDateSafe(item.date), "dd/MM/yyyy"),
            item.sellerShown || "",
            item.productName || "",
            String(item.quantity ?? 0),
            `S/ ${Number(item.price || 0).toFixed(2)}`,
            `S/ ${rowTotal.toFixed(2)}`
          ];
        });

        // Tabla del día
        autoTable(doc, {
          head: [["Correlativo", "Fecha", "Vendedor", "Producto", "Cantidad", "Precio", "Total"]],
          body,
          startY: cursorY,
          styles: { fontSize: 9, cellPadding: 3, halign: "center" },
          headStyles,
          columnStyles: {
            0: { halign: "center" }, 1: { halign: "center" },
            2: { halign: "left" },   3: { halign: "left" },
            4: { halign: "center" }, 5: { halign: "right" }, 6: { halign: "right" }
          },
          margin: { left: 20, right: 14 },
        });

        const lastY = (doc as any).lastAutoTable.finalY || cursorY + 10;

        // Subtotal del día
        const daySubtotal = items.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal ${day}: S/ ${daySubtotal.toFixed(2)}`, pageW - 20, lastY + 6, {
          align: "right",
        });

        // Avanza cursor para siguiente bloque
        cursorY = lastY + 14;

        // Si estamos muy abajo, deja que la siguiente tabla pase a nueva página
        if (cursorY > pageH - 30) {
          doc.addPage();
          cursorY = 20;
        }
      }

      // Total general
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GENERAL: S/ ${grandTotal.toFixed(2)}`, pageW - 20, cursorY, {
        align: "right",
      });

      // Pie de página con paginación (segunda pasada)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 10, { align: "right" });
      }

      const safeName = (clientName || "Cliente").replace(/\s+/g, "_");
      doc.save(`detalle_ventas_${safeName}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error al generar el PDF.");
    }
  };

  const processPayment = async () => {
    if (!selectedDebtor || paymentAmount <= 0) return;

    try {
      const paymentData = {
        clientId: selectedDebtor.id,
        clientName: selectedDebtor.name,
        amount: paymentAmount,
        method: paymentMethod,
        date: paymentDate.toISOString(),
        invoices: selectedInvoices,
        status: "paid",
        paidAt: new Date().toISOString(),
        paidBy: "sistema"
      };

      await RTDBHelper.pushData("payments", paymentData);

      const updates: Record<string, any> = {};
      selectedInvoices.forEach(invoiceId => {
        updates[`${RTDB_PATHS.accounts_receivable}/${selectedDebtor.id}/entries/${invoiceId}/status`] = "paid";
        updates[`${RTDB_PATHS.accounts_receivable}/${selectedDebtor.id}/entries/${invoiceId}/paidAt`] = new Date().toISOString();
      });
      if (Object.keys(updates).length > 0) await RTDBHelper.updateData(updates);

      setPaidInvoices(prev => [...prev, paymentData]);
      const updatedDebtors = await loadDebtors();
      setDebtors(updatedDebtors);

      setShowPaymentDialog(false);
      setPaymentAmount(0);
      setSelectedInvoices([]);
    } catch (error) {
      console.error("Error processing payment:", error);
    }
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Cuentas Pendientes</TabsTrigger>
            <TabsTrigger value="paid">Boletas Pagadas</TabsTrigger>
          </TabsList>

        <TabsContent value="pending" className="space-y-6">
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

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setSelectedDebtorForDetail(debtor);
                          const salesData = await loadSalesDetail(debtor.id);
                          setSalesDetailData(salesData);
                          setFilteredSalesDetail(salesData);
                          setSalesSearchTerm("");
                          setDateFrom(undefined);
                          setDateTo(undefined);
                          setShowSalesDetailDialog(true);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Detalle de Ventas
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDebtor(debtor);
                          setShowCXCDialog(true);
                        }}
                      >
                        <Receipt className="w-4 h-4 mr-1" />
                        CXC
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
          </TabsContent>

          <TabsContent value="paid" className="space-y-6">
            {/* Search for paid invoices */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchPaidTerm}
                  onChange={(e) => setSearchPaidTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Paid invoices table */}
            <Card>
              <CardHeader>
                <CardTitle>Boletas Pagadas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Facturas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidInvoices
                      .filter(payment =>
                        payment.clientName.toLowerCase().includes(searchPaidTerm.toLowerCase()) ||
                        payment.clientId.toLowerCase().includes(searchPaidTerm.toLowerCase())
                      )
                      .map((payment, index) => (
                        <TableRow key={index}>
                          <TableCell>{payment.clientName}</TableCell>
                          <TableCell>{fmtDMY(payment.date)}</TableCell>
                          <TableCell>S/ {Number(payment.amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="capitalize">{payment.method}</TableCell>
                          <TableCell>{(payment.invoices || []).join(", ")}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                        {invoice.id} - S/ {invoice.amount.toFixed(2)} — {invoice.date}
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

              <div>
                <label className="text-sm font-medium">Fecha de Pago</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => date && setPaymentDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
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

      {/* Sales Detail Dialog */}
      <Dialog open={showSalesDetailDialog} onOpenChange={setShowSalesDetailDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalle de Ventas - {selectedDebtorForDetail?.name}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToExcel(filteredSalesDetail, `detalle_ventas_${selectedDebtorForDetail?.name}`)}
                  disabled={filteredSalesDetail.length === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPDF(filteredSalesDetail, selectedDebtorForDetail?.name || "Cliente")}
                  disabled={filteredSalesDetail.length === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por correlativo, producto o vendedor..."
                value={salesSearchTerm}
                onChange={(e) => setSalesSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date filters */}
            <div className="flex gap-4">
              <div>
                <label className="text-sm font-medium">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP", { locale: es }) : <span>Fecha inicio</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP", { locale: es }) : <span>Fecha fin</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sales table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Correlativo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesDetail.length > 0 ? (
                      filteredSalesDetail.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.correlative}</TableCell>
                          <TableCell>{format(toLocalDateSafe(item.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{item.sellerShown}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">S/ {Number(item.price || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">S/ {Number(item.total || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-2">
                            <Search className="w-8 h-8 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {salesDetailData.length === 0
                                ? "No se encontraron ventas para este cliente"
                                : "No se encontraron resultados con los filtros aplicados"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* CXC Dialog */}
      <Dialog open={showCXCDialog} onOpenChange={setShowCXCDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cuentas por Cobrar - {selectedDebtor?.name}</DialogTitle>
          </DialogHeader>

          {selectedDebtor && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona las boletas que deseas marcar como pagadas:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedDebtor.invoices
                  .sort((a: any, b: any) => a.dateSort - b.dateSort)
                  .map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`cxc-${invoice.id}`}
                          checked={selectedInvoices.includes(invoice.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedInvoices(prev => [...prev, invoice.id]);
                              setPaymentAmount(prev => prev + invoice.amount);
                            } else {
                              setSelectedInvoices(prev => prev.filter(id => id !== invoice.id));
                              setPaymentAmount(prev => prev - invoice.amount);
                            }
                          }}
                        />
                        <div>
                          <p className="font-medium">{invoice.id}</p>
                          <p className="text-sm text-muted-foreground">{invoice.date}</p>
                        </div>
                      </div>
                      <p className="font-semibold">S/ {invoice.amount.toFixed(2)}</p>
                    </div>
                  ))
                }
              </div>

              <div className="bg-muted p-4 rounded">
                <p className="text-lg font-semibold">
                  Total seleccionado: S/ {paymentAmount.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="text-sm font-medium">Fecha de Pago</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !paymentDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, "dd/MM", { locale: es }) : <span>Fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={paymentDate}
                        onSelect={(date) => date && setPaymentDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => {
                    processPayment();
                    setShowCXCDialog(false);
                  }}
                  className="flex-1"
                  disabled={selectedInvoices.length === 0}
                >
                  Procesar Pago
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCXCDialog(false);
                  setSelectedInvoices([]);
                  setPaymentAmount(0);
                }}>
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

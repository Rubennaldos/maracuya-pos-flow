// AccountsReceivable.tsx (corregido: CxC marca paid por entryId + sin warnings de Dialog)
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
  CheckCircle, Clock, FileText, Receipt, Download, Edit2, Trash2,
  Calendar as CalendarIcon, Filter, Eye
} from "lucide-react";
import { WhatsAppHelper } from "./WhatsAppHelper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parse, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

/* ===== Helpers ===== */
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

/* ===== Carga de boletas pagadas ===== */
const loadPaidInvoices = async () => {
  try {
    const paidList: any[] = [];
    
    // 1. Cargar pagos registrados desde "payments"
    const paymentsData = await RTDBHelper.getData<Record<string, any>>("payments");
    if (paymentsData) {
      Object.entries(paymentsData).forEach(([paymentId, payment]: [string, any]) => {
        if (payment && payment.status === "paid") {
          paidList.push({
            id: paymentId,
            clientId: payment.clientId,
            clientName: payment.clientName,
            amount: payment.amount,
            method: payment.method,
            date: payment.date,
            paidAt: payment.paidAt,
            invoices: payment.invoices || [],
            source: "payments"
          });
        }
      });
    }

    // 2. Cargar entradas marcadas como "paid" desde accounts_receivable
    const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
    if (arData) {
      Object.entries(arData).forEach(([clientId, clientData]) => {
        const cData = clientData as any;
        if (cData && typeof cData === "object" && cData.entries) {
          Object.entries(cData.entries).forEach(([entryId, entry]: [string, any]) => {
            if (entry?.status === "paid") {
              paidList.push({
                id: entryId,
                clientId,
                clientName: entry.clientName || "Cliente",
                amount: entry.amount,
                method: entry.method || "efectivo",
                date: entry.paidAt || entry.date,
                paidAt: entry.paidAt,
                invoices: [entry.correlative || entryId],
                source: "accounts_receivable"
              });
            }
          });
        }
      });
    }

    // Ordenar por fecha de pago descendente
    return paidList.sort((a, b) => 
      new Date(b.paidAt || b.date).getTime() - new Date(a.paidAt || a.date).getTime()
    );
  } catch (error) {
    console.error("Error loading paid invoices:", error);
    return [];
  }
};

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
        entryId: string;         // 🔑 clave real del entry en RTDB
        correlative: string;     // lo que se muestra al usuario
        amount: number;
        paidAmount?: number;     // monto ya pagado (para abonos parciales)
        remainingAmount?: number; // monto pendiente
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
        Object.entries(entries).forEach(([entryId, entry]) => {
          if ((entry as any)?.status === "pending") {
            const d = ensureDebtor(clientId, (entry as any).clientName);
            const amount = Number((entry as any).amount || 0);
            const paidAmount = Number((entry as any).paidAmount || 0);
            const remainingAmount = amount - paidAmount;
            
            // Solo agregar si tiene deuda pendiente
            if (remainingAmount > 0) {
              d.totalDebt += remainingAmount;

              const dObj = toLocalDateSafe((entry as any).date);
              d.invoices.push({
                entryId, // 🔑 importante
                correlative: (entry as any).correlative || (entry as any).saleId || entryId,
                amount,
                paidAmount,
                remainingAmount,
                date: format(dObj, "dd/MM/yyyy"),
                dateSort: dObj.getTime(),
                type: (entry as any).type,
                products: Array.isArray((entry as any).items)
                  ? (entry as any).items.map((it: any) => it?.name).filter(Boolean)
                  : [],
              });
            }
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
        const paidAmount = Number(flat.paidAmount || 0);
        const remainingAmount = amount - paidAmount;
        
        // Solo agregar si tiene deuda pendiente
        if (remainingAmount > 0) {
          d.totalDebt += remainingAmount;

          const dObj = toLocalDateSafe(flat.date);
          const entryId = flat.saleId || key; // mejor esfuerzo
          d.invoices.push({
            entryId,
            correlative: flat.correlative || flat.saleId || key,
            amount,
            paidAmount,
            remainingAmount,
            date: format(dObj, "dd/MM/yyyy"),
            dateSort: dObj.getTime(),
            type: flat.type,
            products: Array.isArray(flat.items)
              ? flat.items.map((it: any) => it?.name).filter(Boolean)
              : [],
          });
        }
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
  const [paidSearchFilters, setPaidSearchFilters] = useState({
    client: "",
    method: "all",
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    minAmount: "",
    maxAmount: ""
  });
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [showEditPaymentDialog, setShowEditPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [customPaymentAmount, setCustomPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]); // guarda entryId
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
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
  const [showInvoicesSheet, setShowInvoicesSheet] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [debtorsData, paidData] = await Promise.all([
        loadDebtors(),
        loadPaidInvoices()
      ]);
      setDebtors(debtorsData);
      setPaidInvoices(paidData);
      setLoading(false);
    };
    fetchData();
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

  // Filtros inteligentes para boletas pagadas
  const filteredPaidInvoices = paidInvoices.filter((payment) => {
    const matchesClient = payment.clientName.toLowerCase().includes(paidSearchFilters.client.toLowerCase()) ||
                         payment.clientId.toLowerCase().includes(paidSearchFilters.client.toLowerCase());
    
    const matchesMethod = !paidSearchFilters.method || paidSearchFilters.method === "all" || payment.method === paidSearchFilters.method;
    
    const paymentDate = new Date(payment.paidAt || payment.date);
    const matchesDateFrom = !paidSearchFilters.dateFrom || paymentDate >= paidSearchFilters.dateFrom;
    const matchesDateTo = !paidSearchFilters.dateTo || paymentDate <= paidSearchFilters.dateTo;
    
    const amount = Number(payment.amount || 0);
    const matchesMinAmount = !paidSearchFilters.minAmount || amount >= Number(paidSearchFilters.minAmount);
    const matchesMaxAmount = !paidSearchFilters.maxAmount || amount <= Number(paidSearchFilters.maxAmount);
    
    return matchesClient && matchesMethod && matchesDateFrom && matchesDateTo && matchesMinAmount && matchesMaxAmount;
  });

  const totalDebt = debtors.reduce((sum, d) => sum + (d.totalDebt || 0), 0);
  const urgentCount = debtors.filter((d) => d.urgentCollection).length;

  const generateWhatsAppMessage = (debtor: any, type: "simple" | "detailed" | "full") => {
    let message = `Hola ${debtor.name.split(" ")[0]}, `;

    if (type === "simple") {
      message += `tienes una deuda pendiente de S/ ${debtor.totalDebt.toFixed(2)} en Maracuyá Villa Gratia. Por favor, acércate para realizar el pago.`;
    } else if (type === "detailed") {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach((inv: any) => {
        message += `• ${inv.correlative} - S/ ${inv.amount.toFixed(2)} (${inv.date})\n`;
      });
      message += `\nTotal: S/ ${debtor.totalDebt.toFixed(2)}`;
    } else {
      message += `tienes las siguientes deudas pendientes en Maracuyá Villa Gratia:\n\n`;
      debtor.invoices.forEach((inv: any) => {
        message += `📄 ${inv.correlative} - ${inv.date}\n`;
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

  /* ===== Detalle de ventas pendientes (solo deudas) ===== */
  const loadSalesDetail = async (clientId: string) => {
    try {
      // Obtener solo las cuentas por cobrar pendientes del cliente
      const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
      if (!arData) return [];

      const clientDebtDetails: any[] = [];

      // Buscar las deudas pendientes del cliente específico
      const clientArData = arData[clientId];
      if (clientArData && clientArData.entries) {
        // Formato nuevo (agrupado por cliente)
        Object.entries(clientArData.entries).forEach(([entryId, entry]: [string, any]) => {
          if (entry?.status === "pending") {
            const items = Array.isArray(entry.items) ? entry.items : [];
            const sellerRaw = entry.userName || entry.seller || entry.user || entry.cashier || "Sistema";

            if (items.length > 0) {
              items.forEach((item: any) => {
                clientDebtDetails.push({
                  saleId: entry.saleId || entryId,
                  correlative: entry.correlative || entry.saleId || entryId,
                  date: entry.date || entry.createdAt,
                  sellerRaw,
                  clientName: entry.clientName || "Cliente",
                  productName: item.name || "Producto",
                  quantity: item.quantity || 1,
                  price: item.price || 0,
                  total: (item.quantity || 1) * (item.price || 0),
                  paymentMethod: entry.paymentMethod || "crédito",
                  status: "pendiente"
                });
              });
            } else {
              // Si no hay items detallados, mostrar la entrada como un solo item
              clientDebtDetails.push({
                saleId: entry.saleId || entryId,
                correlative: entry.correlative || entry.saleId || entryId,
                date: entry.date || entry.createdAt,
                sellerRaw,
                clientName: entry.clientName || "Cliente",
                productName: entry.description || "Venta a crédito",
                quantity: 1,
                price: entry.amount || 0,
                total: entry.amount || 0,
                paymentMethod: entry.paymentMethod || "crédito",
                status: "pendiente"
              });
            }
          }
        });
      } else {
        // Buscar en formato plano/legado
        Object.entries(arData).forEach(([key, value]) => {
          const flat = value as any;
          const looksEntry =
            flat && typeof flat === "object" && flat.status && (flat.amount !== undefined) && !flat.entries;

          if (looksEntry && flat.status === "pending" && (flat.clientId === clientId || key.includes(clientId))) {
            const items = Array.isArray(flat.items) ? flat.items : [];
            const sellerRaw = flat.userName || flat.seller || flat.user || flat.cashier || "Sistema";

            if (items.length > 0) {
              items.forEach((item: any) => {
                clientDebtDetails.push({
                  saleId: flat.saleId || key,
                  correlative: flat.correlative || flat.saleId || key,
                  date: flat.date || flat.createdAt,
                  sellerRaw,
                  clientName: flat.clientName || "Cliente",
                  productName: item.name || "Producto",
                  quantity: item.quantity || 1,
                  price: item.price || 0,
                  total: (item.quantity || 1) * (item.price || 0),
                  paymentMethod: flat.paymentMethod || "crédito",
                  status: "pendiente"
                });
              });
            } else {
              clientDebtDetails.push({
                saleId: flat.saleId || key,
                correlative: flat.correlative || flat.saleId || key,
                date: flat.date || flat.createdAt,
                sellerRaw,
                clientName: flat.clientName || "Cliente",
                productName: flat.description || "Venta a crédito",
                quantity: 1,
                price: flat.amount || 0,
                total: flat.amount || 0,
                paymentMethod: flat.paymentMethod || "crédito",
                status: "pendiente"
              });
            }
          }
        });
      }

      const withSellerName = await Promise.all(
        clientDebtDetails.map(async (r) => ({
          ...r,
          sellerShown: await resolveVendorName(r.sellerRaw),
        }))
      );

      return withSellerName.sort(
        (a, b) => toLocalDateSafe(b.date).getTime() - toLocalDateSafe(a.date).getTime()
      );
    } catch (error) {
      console.error("Error loading debt details:", error);
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

      // Rango de fechas
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

      const entries = Array.from(groups.entries()).sort(
        ([a], [b]) => toLocalDateSafe(a).getTime() - toLocalDateSafe(b).getTime()
      );

      const headStyles = { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" as const };
      let grandTotal = 0;

      for (const [day, items] of entries) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(day, 20, cursorY);
        cursorY += 4;

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

        const daySubtotal = items.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal ${day}: S/ ${daySubtotal.toFixed(2)}`, pageW - 20, lastY + 6, {
          align: "right",
        });

        cursorY = lastY + 14;

        if (cursorY > pageH - 30) {
          doc.addPage();
          cursorY = 20;
        }
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GENERAL: S/ ${grandTotal.toFixed(2)}`, pageW - 20, cursorY, {
        align: "right",
      });

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

  /* ===== Procesar pago (marca paid por entryId) ===== */
  const processPayment = async (isPartialPayment: boolean = false) => {
    if (!selectedDebtor) return;

    const amountToPay = isPartialPayment 
      ? parseFloat(customPaymentAmount) || 0 
      : paymentAmount;

    if (amountToPay <= 0) {
      alert("Por favor ingresa un monto válido");
      return;
    }

    try {
      // Determinar las facturas a pagar
      let invoicesToPay = selectedInvoices;
      
      // Si no hay facturas seleccionadas, usar la más antigua
      if (invoicesToPay.length === 0) {
        const sortedInvoices = [...selectedDebtor.invoices].sort((a: any, b: any) => a.dateSort - b.dateSort);
        if (sortedInvoices.length > 0) {
          invoicesToPay = [sortedInvoices[0].entryId];
        } else {
          alert("No hay facturas disponibles para pagar");
          return;
        }
      }

      // Calcular el monto total pendiente de las facturas seleccionadas
      const totalSelectedInvoices = invoicesToPay.reduce((sum, entryId) => {
        const invoice = selectedDebtor.invoices.find((inv: any) => inv.entryId === entryId);
        return sum + (invoice?.remainingAmount || invoice?.amount || 0);
      }, 0);

      // Si es abono parcial, distribuir el monto
      if (isPartialPayment) {
        let remainingAmount = amountToPay;
        const updates: Record<string, any> = {};
        
        // Ordenar facturas de más antigua a más reciente
        const sortedSelectedInvoices = invoicesToPay
          .map(entryId => selectedDebtor.invoices.find((inv: any) => inv.entryId === entryId))
          .filter(Boolean)
          .sort((a: any, b: any) => a.dateSort - b.dateSort);

        for (const invoice of sortedSelectedInvoices) {
          if (remainingAmount <= 0) break;

          const base = `${RTDB_PATHS.accounts_receivable}/${selectedDebtor.id}/entries/${invoice.entryId}`;
          const currentPaid = invoice.paidAmount || 0;
          const invoiceRemaining = invoice.remainingAmount || (invoice.amount - currentPaid);
          
          if (remainingAmount >= invoiceRemaining) {
            // Pagar el resto de la factura (completa)
            const newPaidAmount = currentPaid + invoiceRemaining;
            updates[`${base}/status`] = "paid";
            updates[`${base}/paidAt`] = new Date().toISOString();
            updates[`${base}/method`] = paymentMethod;
            updates[`${base}/paidAmount`] = newPaidAmount;
            remainingAmount -= invoiceRemaining;
          } else {
            // Abono parcial a esta factura
            const newPaidAmount = currentPaid + remainingAmount;
            
            updates[`${base}/paidAmount`] = newPaidAmount;
            updates[`${base}/method`] = paymentMethod;
            updates[`${base}/lastPaymentAt`] = new Date().toISOString();
            
            // Si se completó el pago de esta factura (por si acaso)
            if (newPaidAmount >= invoice.amount) {
              updates[`${base}/status`] = "paid";
              updates[`${base}/paidAt`] = new Date().toISOString();
            }
            
            remainingAmount = 0;
          }
        }

        if (Object.keys(updates).length > 0) {
          await RTDBHelper.updateData(updates);
        }

        // Registrar el abono
        const paymentData = {
          clientId: selectedDebtor.id,
          clientName: selectedDebtor.name,
          amount: amountToPay,
          method: paymentMethod,
          date: paymentDate.toISOString(),
          invoices: invoicesToPay,
          status: "partial",
          paidAt: new Date().toISOString(),
          paidBy: "sistema",
          isPartial: true,
        };
        await RTDBHelper.pushData("payments", paymentData);
      } else {
        // Pago completo
        const paymentData = {
          clientId: selectedDebtor.id,
          clientName: selectedDebtor.name,
          amount: amountToPay,
          method: paymentMethod,
          date: paymentDate.toISOString(),
          invoices: invoicesToPay,
          status: "paid",
          paidAt: new Date().toISOString(),
          paidBy: "sistema",
          isPartial: false,
        };

        await RTDBHelper.pushData("payments", paymentData);

        // Marcar todas las facturas seleccionadas como pagadas
        const updates: Record<string, any> = {};
        invoicesToPay.forEach(entryId => {
          const base = `${RTDB_PATHS.accounts_receivable}/${selectedDebtor.id}/entries/${entryId}`;
          updates[`${base}/status`] = "paid";
          updates[`${base}/paidAt`] = new Date().toISOString();
          updates[`${base}/method`] = paymentMethod;
        });
        if (Object.keys(updates).length > 0) await RTDBHelper.updateData(updates);
      }

      // Recargar datos
      const [updatedDebtors, updatedPaid] = await Promise.all([
        loadDebtors(),
        loadPaidInvoices()
      ]);
      setDebtors(updatedDebtors);
      setPaidInvoices(updatedPaid);

      setShowPaymentDialog(false);
      setShowCXCDialog(false);
      setPaymentAmount(0);
      setCustomPaymentAmount("");
      setSelectedInvoices([]);
      setLastSelectedIndex(null);
      
      alert(`Pago procesado exitosamente: S/ ${amountToPay.toFixed(2)}`);
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error al procesar el pago. Por favor intenta nuevamente.");
    }
  };

  const toggleUrgentCollection = (debtorId: string) => {
    setDebtors((prev) =>
      prev.map((d) =>
        d.id === debtorId ? { ...d, urgentCollection: !d.urgentCollection } : d
      )
    );
  };

  const updatePaymentMethod = async (paymentId: string, newMethod: string) => {
    try {
      const payment = paidInvoices.find(p => p.id === paymentId);
      if (!payment) return;

      if (payment.source === "payments") {
        await RTDBHelper.updateData({ [`payments/${paymentId}/method`]: newMethod });
      } else if (payment.source === "accounts_receivable") {
        await RTDBHelper.updateData({ 
          [`${RTDB_PATHS.accounts_receivable}/${payment.clientId}/entries/${paymentId}/method`]: newMethod 
        });
      }

      const updatedPaid = await loadPaidInvoices();
      setPaidInvoices(updatedPaid);
    } catch (error) {
      console.error("Error updating payment method:", error);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const payment = paidInvoices.find(p => p.id === paymentId);
      if (!payment) return;

      if (payment.source === "payments") {
        await RTDBHelper.removeData(`payments/${paymentId}`);
        
        // Marcar las facturas como pendientes nuevamente
        if (payment.invoices && payment.invoices.length > 0) {
          const updates: Record<string, any> = {};
          payment.invoices.forEach((entryId: string) => {
            const base = `${RTDB_PATHS.accounts_receivable}/${payment.clientId}/entries/${entryId}`;
            updates[`${base}/status`] = "pending";
            updates[`${base}/paidAt`] = null;
            updates[`${base}/method`] = null;
          });
          if (Object.keys(updates).length > 0) {
            await RTDBHelper.updateData(updates);
          }
        }
      } else if (payment.source === "accounts_receivable") {
        const updates = {
          [`${RTDB_PATHS.accounts_receivable}/${payment.clientId}/entries/${paymentId}/status`]: "pending",
          [`${RTDB_PATHS.accounts_receivable}/${payment.clientId}/entries/${paymentId}/paidAt`]: null,
          [`${RTDB_PATHS.accounts_receivable}/${payment.clientId}/entries/${paymentId}/method`]: null,
        };
        await RTDBHelper.updateData(updates);
      }

      // Recargar datos
      const [updatedDebtors, updatedPaid] = await Promise.all([
        loadDebtors(),
        loadPaidInvoices()
      ]);
      setDebtors(updatedDebtors);
      setPaidInvoices(updatedPaid);
    } catch (error) {
      console.error("Error deleting payment:", error);
    }
  };

  const clearPaidFilters = () => {
    setPaidSearchFilters({
      client: "",
      method: "all",
      dateFrom: null,
      dateTo: null,
      minAmount: "",
      maxAmount: ""
    });
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
                      {/* 🔸 Eliminado botón "Registrar Pago" (se usa CXC) */}

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
                          // Preparar CxC
                          setSelectedDebtor(debtor);
                          setSelectedInvoices([]);
                          setPaymentAmount(0);
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
            {/* Filtros inteligentes para boletas pagadas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtros de Búsqueda Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Cliente</label>
                    <Input
                      placeholder="Buscar por nombre o ID..."
                      value={paidSearchFilters.client}
                      onChange={(e) => setPaidSearchFilters(prev => ({ ...prev, client: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Método de Pago</label>
                    <Select 
                      value={paidSearchFilters.method} 
                      onValueChange={(value) => setPaidSearchFilters(prev => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los métodos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los métodos</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="yape">Yape</SelectItem>
                        <SelectItem value="plin">Plin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={clearPaidFilters} size="sm">
                      Limpiar Filtros
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium">Fecha Desde</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !paidSearchFilters.dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {paidSearchFilters.dateFrom ? format(paidSearchFilters.dateFrom, "dd/MM/yyyy") : "Desde"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={paidSearchFilters.dateFrom}
                          onSelect={(date) => setPaidSearchFilters(prev => ({ ...prev, dateFrom: date }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Fecha Hasta</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !paidSearchFilters.dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {paidSearchFilters.dateTo ? format(paidSearchFilters.dateTo, "dd/MM/yyyy") : "Hasta"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={paidSearchFilters.dateTo}
                          onSelect={(date) => setPaidSearchFilters(prev => ({ ...prev, dateTo: date }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Monto Mínimo</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paidSearchFilters.minAmount}
                      onChange={(e) => setPaidSearchFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Monto Máximo</label>
                    <Input
                      type="number"
                      placeholder="999.99"
                      value={paidSearchFilters.maxAmount}
                      onChange={(e) => setPaidSearchFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Boletas pagadas table */}
            <Card>
              <CardHeader>
                <CardTitle>Boletas Pagadas ({filteredPaidInvoices.length})</CardTitle>
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
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaidInvoices.length > 0 ? (
                      filteredPaidInvoices.map((payment, index) => (
                        <TableRow key={payment.id || index}>
                          <TableCell className="font-medium">{payment.clientName}</TableCell>
                          <TableCell>{fmtDMY(payment.paidAt || payment.date)}</TableCell>
                          <TableCell className="font-semibold">S/ {Number(payment.amount || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {payment.method || "efectivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate" title={(payment.invoices || []).join(", ")}>
                              {(payment.invoices || []).join(", ")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPayment(payment);
                                  setShowEditPaymentDialog(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deletePayment(payment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-2">
                            <Receipt className="w-8 h-8 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {paidInvoices.length === 0
                                ? "No hay boletas pagadas registradas"
                                : "No se encontraron resultados con los filtros aplicados"}
                            </p>
                            {paidInvoices.length > 0 && (
                              <Button variant="outline" size="sm" onClick={clearPaidFilters}>
                                Limpiar filtros
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* (Opcional) Dialog de pago directo: lo dejo, pero ya no se muestra botón para abrirlo */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago - {selectedDebtor?.name}</DialogTitle>
            <DialogDescription>Registra un pago manual. Recomendado usar CXC.</DialogDescription>
          </DialogHeader>
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
            <DialogDescription>Filtra y exporta el detalle de ventas del cliente seleccionado.</DialogDescription>
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

      {/* CXC Dialog - Estilo Excel con selección múltiple y Shift */}
      <Dialog open={showCXCDialog} onOpenChange={setShowCXCDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Cuentas por Cobrar - {selectedDebtor?.name}</DialogTitle>
            <DialogDescription>Selecciona las facturas y procesa el pago (Shift+Click para rango)</DialogDescription>
          </DialogHeader>

          {selectedDebtor && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Botones de acción rápida */}
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInvoicesSheet(true)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Todas las Boletas
                </Button>
                
                <div className="h-4 w-px bg-border" />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allEntryIds = selectedDebtor.invoices.map((inv: any) => inv.entryId);
                    setSelectedInvoices(allEntryIds);
                    setPaymentAmount(selectedDebtor.totalDebt);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Seleccionar Todo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedInvoices([]);
                    setPaymentAmount(0);
                    setLastSelectedIndex(null);
                  }}
                >
                  Deseleccionar
                </Button>
              </div>

              {/* Resumen de selección */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Facturas seleccionadas</p>
                      <p className="text-2xl font-bold">{selectedInvoices.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total seleccionado</p>
                      <p className="text-2xl font-bold text-primary">S/ {paymentAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deuda total del cliente</p>
                      <p className="text-2xl font-bold">S/ {selectedDebtor.totalDebt.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen y opciones de pago */}
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
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

                  <div className="space-y-2">
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
                          {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: es }) : <span>Fecha</span>}
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

                {/* Totales y acciones */}
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Facturas seleccionadas:</span>
                    <span className="font-semibold">{selectedInvoices.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total seleccionado:</span>
                    <span className="text-2xl font-bold text-primary">
                      S/ {paymentAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Deuda total del cliente:</span>
                    <span>S/ {selectedDebtor.totalDebt.toFixed(2)}</span>
                  </div>

                  {/* Campo para abono parcial */}
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium">Monto de Abono Parcial (opcional)</label>
                    <Input
                      type="number"
                      placeholder="Ingresa el monto del abono..."
                      value={customPaymentAmount}
                      onChange={(e) => setCustomPaymentAmount(e.target.value)}
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Deja vacío para pagar el total seleccionado
                    </p>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => processPayment(false)}
                    className="flex-1"
                    disabled={selectedInvoices.length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Pagar Completo (S/ {paymentAmount.toFixed(2)})
                  </Button>
                  <Button
                    onClick={() => processPayment(true)}
                    variant="secondary"
                    className="flex-1"
                    disabled={!customPaymentAmount || parseFloat(customPaymentAmount) <= 0}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Abonar S/ {customPaymentAmount || "0.00"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCXCDialog(false);
                      setSelectedInvoices([]);
                      setPaymentAmount(0);
                      setCustomPaymentAmount("");
                      setLastSelectedIndex(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={showEditPaymentDialog} onOpenChange={setShowEditPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Método de Pago</DialogTitle>
            <DialogDescription>
              Modifica el método de pago para {editingPayment?.clientName}
            </DialogDescription>
          </DialogHeader>

          {editingPayment && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Monto: S/ {Number(editingPayment.amount).toFixed(2)}</label>
              </div>
              <div>
                <label className="text-sm font-medium">Método de Pago</label>
                <Select 
                  value={editingPayment.method || "efectivo"} 
                  onValueChange={(value) => setEditingPayment(prev => ({ ...prev, method: value }))}
                >
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
                <Button
                  onClick={async () => {
                    await updatePaymentMethod(editingPayment.id, editingPayment.method);
                    setShowEditPaymentDialog(false);
                    setEditingPayment(null);
                  }}
                  className="flex-1"
                >
                  Guardar Cambios
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditPaymentDialog(false);
                    setEditingPayment(null);
                  }}
                >
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

      {/* Sheet para ver todas las boletas */}
      <Sheet open={showInvoicesSheet} onOpenChange={setShowInvoicesSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Todas las Boletas - {selectedDebtor?.name}</SheetTitle>
            <SheetDescription>
              Deuda total: S/ {selectedDebtor?.totalDebt.toFixed(2)} | {selectedDebtor?.invoices.length} facturas
            </SheetDescription>
          </SheetHeader>

          {/* Resumen sticky con acciones */}
          <div className="sticky top-0 bg-background z-10 py-4 space-y-3 border-b mb-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Seleccionado</p>
                    <p className="text-3xl font-bold text-primary">S/ {paymentAmount.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Facturas Seleccionadas</p>
                    <p className="text-2xl font-bold">{selectedInvoices.length} / {selectedDebtor?.invoices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const allEntryIds = selectedDebtor.invoices.map((inv: any) => inv.entryId);
                  setSelectedInvoices(allEntryIds);
                  setPaymentAmount(selectedDebtor.totalDebt);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Seleccionar Todo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setSelectedInvoices([]);
                  setPaymentAmount(0);
                  setLastSelectedIndex(null);
                }}
              >
                Deseleccionar
              </Button>
            </div>
          </div>
          
          <div className="space-y-3 pb-6">
            {selectedDebtor?.invoices
              .sort((a: any, b: any) => a.dateSort - b.dateSort)
              .map((invoice: any, index: number) => {
                const isSelected = selectedInvoices.includes(invoice.entryId);
                
                return (
                  <Card 
                    key={invoice.entryId}
                    className={cn(
                      "transition-all cursor-pointer hover:shadow-md",
                      isSelected && "border-primary bg-primary/5"
                    )}
                    onClick={(e) => {
                      const sortedInvoices = [...selectedDebtor.invoices].sort((a: any, b: any) => a.dateSort - b.dateSort);
                      
                      if (e.shiftKey && lastSelectedIndex !== null) {
                        const start = Math.min(lastSelectedIndex, index);
                        const end = Math.max(lastSelectedIndex, index);
                        const rangeEntryIds = sortedInvoices.slice(start, end + 1).map((inv: any) => inv.entryId);
                        
                        const newSelected = [...new Set([...selectedInvoices, ...rangeEntryIds])];
                        setSelectedInvoices(newSelected);
                        
                        const total = newSelected.reduce((sum, id) => {
                          const inv = sortedInvoices.find((i: any) => i.entryId === id);
                          return sum + (inv?.amount || 0);
                        }, 0);
                        setPaymentAmount(total);
                      } else {
                        if (selectedInvoices.includes(invoice.entryId)) {
                          setSelectedInvoices(prev => prev.filter(id => id !== invoice.entryId));
                          setPaymentAmount(prev => prev - invoice.amount);
                        } else {
                          setSelectedInvoices(prev => [...prev, invoice.entryId]);
                          setPaymentAmount(prev => prev + invoice.amount);
                        }
                        setLastSelectedIndex(index);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInvoices(prev => [...prev, invoice.entryId]);
                                setPaymentAmount(prev => prev + invoice.amount);
                              } else {
                                setSelectedInvoices(prev => prev.filter(id => id !== invoice.entryId));
                                setPaymentAmount(prev => prev - invoice.amount);
                              }
                              setLastSelectedIndex(index);
                            }}
                          />
                        </div>
                        
                         <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{invoice.correlative}</p>
                            <div className="text-right">
                              {invoice.paidAmount > 0 ? (
                                <>
                                  <p className="font-bold text-primary">S/ {(invoice.remainingAmount || invoice.amount).toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Pagado: S/ {invoice.paidAmount.toFixed(2)} de S/ {invoice.amount.toFixed(2)}
                                  </p>
                                </>
                              ) : (
                                <p className="font-bold text-primary">S/ {invoice.amount.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">{invoice.date}</p>
                          
                          {invoice.products.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Productos:</p>
                              <div className="flex flex-wrap gap-1">
                                {invoice.products.map((product: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {product}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            }
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

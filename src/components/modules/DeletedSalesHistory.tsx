import { useState, useEffect, useMemo } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// Removed SalesEditor import - using simplified inline editor
import {
  ArrowLeft,
  Search,
  Edit,
  Undo2,
  Eye,
  Calendar as CalendarIcon,
  User,
  DollarSign,
  Trash2,
  RotateCcw,
  CalendarRange,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface DeletedSalesHistoryProps {
  onBack: () => void;
}

type DeletedSale = {
  id: string;
  correlative: string;
  client: string;
  user: string;
  total: number;
  date: string;
  paymentMethod: string;
  type: "normal" | "historical";
  deletedAt: string;
  deletedBy: string;
  originalData: any; // Datos completos de la venta original
};

export const DeletedSalesHistory = ({ onBack }: DeletedSalesHistoryProps) => {
  const [deletedSales, setDeletedSales] = useState<DeletedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "normal" | "historical">("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [editingSale, setEditingSale] = useState<any>(null);

  useEffect(() => {
    loadDeletedSales();
  }, []);

  const loadDeletedSales = async () => {
    try {
      setLoading(true);
      const deletedData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.deleted_sales);
      
      if (!deletedData) {
        setDeletedSales([]);
        return;
      }

      const salesArray: DeletedSale[] = Object.entries(deletedData)
        .map(([id, sale]) => ({
          id,
          correlative: sale.correlative || id,
          client: sale.client?.name || sale.clientName || "Cliente General",
          user: sale.createdBy || sale.user || "Sistema",
          total: sale.total || 0,
          date: sale.createdAt || sale.date || new Date().toISOString(),
          paymentMethod: sale.paymentMethod || "efectivo",
          type: sale.type || "normal",
          deletedAt: sale.deletedAt || new Date().toISOString(),
          deletedBy: sale.deletedBy || "Sistema",
          originalData: sale,
        }))
        .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

      setDeletedSales(salesArray);
    } catch (error) {
      console.error("Error loading deleted sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const restoreSale = async (deletedSale: DeletedSale) => {
    try {
      const { originalData, deletedAt, deletedBy, ...saleData } = deletedSale.originalData;
      
      // Restaurar a la colección original
      const targetPath = deletedSale.type === "historical" 
        ? `${RTDB_PATHS.historical_sales}/${deletedSale.id}`
        : `${RTDB_PATHS.sales}/${deletedSale.id}`;
      
      await RTDBHelper.setData(targetPath, saleData);
      
      // Remover de papelera
      await RTDBHelper.removeData(`${RTDB_PATHS.deleted_sales}/${deletedSale.id}`);
      
      // Actualizar lista local
      setDeletedSales(prev => prev.filter(s => s.id !== deletedSale.id));
      
      alert(`Venta ${deletedSale.correlative} restaurada exitosamente`);
    } catch (error) {
      console.error("Error restoring sale:", error);
      alert("Error al restaurar la venta");
    }
  };

  const permanentlyDelete = async (saleId: string) => {
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.deleted_sales}/${saleId}`);
      setDeletedSales(prev => prev.filter(s => s.id !== saleId));
      alert("Venta eliminada permanentemente");
    } catch (error) {
      console.error("Error permanently deleting sale:", error);
      alert("Error al eliminar la venta permanentemente");
    }
  };

  const handleEditSale = (sale: DeletedSale) => {
    setEditingSale(sale.originalData);
  };

  const handleSaveEdit = async (editedSale: any) => {
    try {
      // Actualizar en papelera con los nuevos datos
      const updatedData = {
        ...editedSale,
        deletedAt: editingSale.deletedAt,
        deletedBy: editingSale.deletedBy,
      };
      
      await RTDBHelper.setData(`${RTDB_PATHS.deleted_sales}/${editedSale.id}`, updatedData);
      setEditingSale(null);
      loadDeletedSales();
      alert("Venta editada exitosamente");
    } catch (error) {
      console.error("Error editing deleted sale:", error);
      alert("Error al editar la venta");
    }
  };

  const filteredSales = useMemo(() => {
    return deletedSales.filter((sale) => {
      const matchesSearch = 
        sale.correlative.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.user.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === "all" || sale.type === typeFilter;
      
      const matchesPayment = paymentFilter === "all" || sale.paymentMethod === paymentFilter;

      let matchesDate = true;
      if (dateRange.from || dateRange.to) {
        const saleDate = parseISO(sale.date);
        if (isValid(saleDate)) {
          if (dateRange.from && dateRange.to) {
            matchesDate = saleDate >= dateRange.from && saleDate <= dateRange.to;
          } else if (dateRange.from) {
            matchesDate = saleDate >= dateRange.from;
          } else if (dateRange.to) {
            matchesDate = saleDate <= dateRange.to;
          }
        }
      }

      return matchesSearch && matchesType && matchesPayment && matchesDate;
    });
  }, [deletedSales, searchTerm, typeFilter, paymentFilter, dateRange]);

  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const uniquePaymentMethods = [...new Set(deletedSales.map(s => s.paymentMethod))];

  if (editingSale) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Editar Venta Eliminada</h2>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setEditingSale(null)}>
              Cancelar
            </Button>
            <Button onClick={() => handleSaveEdit(editingSale)}>
              Guardar Cambios
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Información de la Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="correlative">Correlativo</Label>
                <Input
                  id="correlative"
                  value={editingSale?.correlative || ""}
                  onChange={(e) => setEditingSale({...editingSale, correlative: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="client">Cliente</Label>
                <Input
                  id="client"
                  value={editingSale?.client?.name || editingSale?.clientName || ""}
                  onChange={(e) => setEditingSale({
                    ...editingSale, 
                    client: {...(editingSale?.client || {}), name: e.target.value},
                    clientName: e.target.value
                  })}
                />
              </div>
              <div>
                <Label htmlFor="total">Total</Label>
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={editingSale?.total || 0}
                  onChange={(e) => setEditingSale({...editingSale, total: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select 
                  value={editingSale?.paymentMethod || "efectivo"} 
                  onValueChange={(value) => setEditingSale({...editingSale, paymentMethod: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {editingSale?.notes && (
              <div>
                <Label htmlFor="notes">Notas</Label>
                <Input
                  id="notes"
                  value={editingSale.notes}
                  onChange={(e) => setEditingSale({...editingSale, notes: e.target.value})}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Historial de Eliminados</h2>
            <p className="text-muted-foreground">Papelera de ventas eliminadas</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={loadDeletedSales}
          disabled={loading}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por correlativo, cliente o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de venta" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="normal">Ventas Normales</SelectItem>
                <SelectItem value="historical">Ventas Históricas</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Method Filter */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">Todos los métodos</SelectItem>
                {uniquePaymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method === "efectivo" ? "Efectivo" :
                     method === "tarjeta" ? "Tarjeta" :
                     method === "transferencia" ? "Transferencia" :
                     method === "credito" ? "Crédito" : method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: es })} -{" "}
                        {format(dateRange.to, "dd/MM/yy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: es })
                    )
                  ) : (
                    "Seleccionar fechas"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange(range || {})}
                  numberOfMonths={2}
                  locale={es}
                />
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRange({})}
                    className="w-full"
                  >
                    Limpiar filtro
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Ventas Eliminadas</p>
                <p className="text-2xl font-bold">{filteredSales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Eliminado</p>
                <p className="text-2xl font-bold">S/ {totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="text-lg font-semibold">
                  {dateRange.from && dateRange.to 
                    ? `${format(dateRange.from, "dd/MM", { locale: es })} - ${format(dateRange.to, "dd/MM", { locale: es })}`
                    : "Todas las fechas"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Eliminadas ({filteredSales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando ventas eliminadas...</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay ventas eliminadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-lg font-semibold text-foreground">
                          {sale.correlative}
                        </span>
                        <Badge variant={sale.type === "historical" ? "secondary" : "default"}>
                          {sale.type === "historical" ? "Histórica" : "Normal"}
                        </Badge>
                        <Badge 
                          variant={
                            sale.paymentMethod === "efectivo" ? "default" :
                            sale.paymentMethod === "credito" ? "destructive" : "secondary"
                          }
                        >
                          {sale.paymentMethod === "efectivo" ? "Efectivo" :
                           sale.paymentMethod === "tarjeta" ? "Tarjeta" :
                           sale.paymentMethod === "transferencia" ? "Transferencia" :
                           sale.paymentMethod === "credito" ? "Crédito" : sale.paymentMethod}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Cliente:</span>
                          <span className="font-medium">{sale.client}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-semibold">S/ {sale.total.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Fecha:</span>
                          <span>{format(parseISO(sale.date), "dd/MM/yyyy", { locale: es })}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Eliminado:</span>
                          <span>{format(parseISO(sale.deletedAt), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Vendedor: {sale.user} • Eliminado por: {sale.deletedBy}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSale(sale)}
                        className="text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success hover:bg-success hover:text-success-foreground"
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Restaurar venta?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              La venta {sale.correlative} será restaurada a su ubicación original ({sale.type === "historical" ? "Ventas Históricas" : "Lista de Ventas"}).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => restoreSale(sale)}
                              className="bg-success text-success-foreground hover:bg-success/90"
                            >
                              Restaurar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar permanentemente?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. La venta {sale.correlative} será eliminada permanentemente de la papelera.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => permanentlyDelete(sale.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar Permanentemente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
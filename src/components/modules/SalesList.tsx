import { useState, useEffect } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SalesEditor } from "./SalesEditor";
import { PrintManager } from "@/lib/print";
import { 
  ArrowLeft, Search, Edit, Trash2, Eye, Calendar, User, DollarSign,
  AlertTriangle, Clock, Printer
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


interface SalesListProps {
  onBack: () => void;
}

export const SalesList = ({ onBack }: SalesListProps) => {
  const [sales, setSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Load sales from RTDB
  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const salesData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.sales);
      if (salesData) {
        const salesArray = Object.entries(salesData).map(([id, sale]) => ({
          ...sale,
          id, // Asegurar que el ID esté presente
          date: new Date(sale.date || sale.createdAt).toLocaleDateString(),
          time: new Date(sale.date || sale.createdAt).toLocaleTimeString(),
          client: sale.client?.fullName || sale.client?.name || sale.client || 'Cliente Varios',
          user: sale.createdBy || sale.cashier || 'Sistema'
        })).sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setSales(salesArray);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.correlative.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteSale = async (saleId: string) => {
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.sales}/${saleId}`);
      setSales(prev => prev.filter(sale => sale.id !== saleId));
    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  };

  const handleSaveEdit = async (editedSale: any) => {
    try {
      const updates = {
        [`${RTDB_PATHS.sales}/${editedSale.id}`]: editedSale
      };
      await RTDBHelper.updateData(updates);
      setSales(prev => prev.map(sale => 
        sale.id === editedSale.id ? editedSale : sale
      ));
    } catch (error) {
      console.error('Error updating sale:', error);
    }
  };

  const handleReprintTicket = async (sale: any) => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    try {
      const printableOrder = {
        id: sale.id,
        correlative: sale.correlative,
        date: sale.date || new Date(sale.createdAt).toLocaleDateString(),
        time: sale.time || new Date(sale.createdAt).toLocaleTimeString(),
        client: sale.client,
        items: sale.items || [],
        subtotal: sale.subtotal || sale.total,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        type: "customer" as const,
        user: sale.user
      };

      await PrintManager.printCustomerTicket(printableOrder);
    } catch (error) {
      console.error('Error reprinting ticket:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completada</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground">Pendiente</Badge>;
      case 'delivered':
        return <Badge className="bg-primary text-primary-foreground">Entregada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'normal':
        return <Badge variant="outline">Normal</Badge>;
      case 'lunch':
        return <Badge className="bg-accent text-accent-foreground">Almuerzo</Badge>;
      case 'scheduled':
        return <Badge className="bg-secondary text-secondary-foreground">Programada</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
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
            <h1 className="text-2xl font-bold text-foreground">Lista de Ventas</h1>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por comprobante, cliente o método de pago..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sales Table */}
        <div className="space-y-4">
          {filteredSales.map((sale) => (
            <Card key={sale.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold text-lg">{sale.correlative}</h3>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {sale.date} - {sale.time}
                      </p>
                    </div>
                    {getTypeBadge(sale.type)}
                    {getStatusBadge(sale.status)}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingSale(sale)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleReprintTicket(sale)}
                      disabled={isPrinting}
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      {isPrinting ? 'Imprimiendo...' : 'Reimprimir'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                            ¿Eliminar venta?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La venta {sale.correlative} será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSale(sale.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Cliente:</strong> {sale.client}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Total:</strong> S/ {sale.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Vendedor:</strong> {sale.user}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-sm">
                  <strong>Productos:</strong>
                  <ul className="mt-2 space-y-1">
                    {sale.items.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        <span>S/ {(item.quantity * item.price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron ventas</h3>
            <p className="text-muted-foreground">Intenta con otros términos de búsqueda</p>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalle de Venta</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSale(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Comprobante:</strong>
                  <p>{selectedSale.correlative}</p>
                </div>
                <div>
                  <strong>Fecha:</strong>
                  <p>{selectedSale.date}</p>
                </div>
                <div>
                  <strong>Hora:</strong>
                  <p>{selectedSale.time}</p>
                </div>
                <div>
                  <strong>Cliente:</strong>
                  <p>{selectedSale.client}</p>
                </div>
                <div>
                  <strong>Método de Pago:</strong>
                  <p className="capitalize">{selectedSale.paymentMethod}</p>
                </div>
                <div>
                  <strong>Vendedor:</strong>
                  <p>{selectedSale.user}</p>
                </div>
              </div>

              <Separator />

              <div>
                <strong className="text-sm">Productos:</strong>
                <div className="mt-2 space-y-2">
                  {selectedSale.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span>S/ {(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>S/ {selectedSale.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Editor */}
      <SalesEditor
        sale={editingSale}
        isOpen={!!editingSale}
        onClose={() => setEditingSale(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
};
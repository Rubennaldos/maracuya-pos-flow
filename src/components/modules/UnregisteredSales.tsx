import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Search, AlertTriangle, RefreshCw, Trash2,
  Clock, User, DollarSign, AlertCircle, CheckCircle, XCircle
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
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

// Load unregistered sales from RTDB
const loadUnregisteredSales = async () => {
  try {
    const unregSalesData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.unregistered_sales);
    if (unregSalesData) {
      return Object.values(unregSalesData);
    }
    return [];
  } catch (error) {
    console.error('Error loading unregistered sales:', error);
    return [];
  }
};

interface UnregisteredSalesProps {
  onBack: () => void;
}

export const UnregisteredSales = ({ onBack }: UnregisteredSalesProps) => {
  const [unregisteredSales, setUnregisteredSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Load unregistered sales from RTDB
  useEffect(() => {
    loadUnregisteredSales().then(setUnregisteredSales);
  }, []);

  const filteredSales = unregisteredSales.filter((sale: any) =>
    sale.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const retrySale = async (sale: any) => {
    try {
      // Attempt to register the sale again
      const correlative = await RTDBHelper.getNextCorrelative('sale');
      
      const saleData = {
        ...sale,
        correlative,
        status: 'completed',
        retryDate: new Date().toISOString(),
        attempts: (sale.attempts || 0) + 1
      };

      // Save to main sales collection
      await RTDBHelper.pushData(RTDB_PATHS.sales, saleData);
      
      // Remove from unregistered sales
      await RTDBHelper.removeData(`${RTDB_PATHS.unregistered_sales}/${sale.id}`);
      
      // Update local state
      setUnregisteredSales(prev => prev.filter((s: any) => s.id !== sale.id));
      
      alert(`Venta registrada exitosamente con correlativo: ${correlative}`);
    } catch (error) {
      console.error('Error retrying sale:', error);
      alert('Error al reintentar el registro de la venta');
    }
  };

  const deleteSale = async (saleId: string) => {
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.unregistered_sales}/${saleId}`);
      setUnregisteredSales(prev => prev.filter((s: any) => s.id !== saleId));
      alert('Venta eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Error al eliminar la venta');
    }
  };

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'correlative':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'validation':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getErrorColor = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return 'bg-yellow-50 border-yellow-200';
      case 'correlative':
        return 'bg-orange-50 border-orange-200';
      case 'validation':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Button>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Ventas No Registradas
          </h2>
          <Badge variant="destructive" className="text-sm">
            {filteredSales.length} ventas pendientes
          </Badge>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente o ID de venta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sales List */}
        <div className="space-y-4">
          {filteredSales.map((sale: any) => (
            <Card key={sale.id} className={`border-l-4 ${getErrorColor(sale.errorType)}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {getErrorIcon(sale.errorType)}
                    <CardTitle className="text-lg">{sale.client}</CardTitle>
                    <Badge variant="outline">{sale.id}</Badge>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {sale.date} - {sale.time}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3" />
                      {sale.user}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Error Information */}
                  <div className="p-3 rounded border border-dashed border-muted-foreground/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-destructive">
                          Error: {sale.errorType?.toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sale.errorMessage}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Intentos: {sale.attempts || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sale Items */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Productos:</h4>
                    <div className="space-y-1">
                      {sale.items?.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.name} x{item.quantity}</span>
                          <span>S/ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-medium">
                      <span>Total:</span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        S/ {sale.total?.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Método: {sale.paymentMethod}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {sale.canRetry !== false && (
                      <Button
                        onClick={() => retrySale(sale)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reintentar
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar venta no registrada?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La venta de {sale.client} por S/ {sale.total?.toFixed(2)} será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteSale(sale.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredSales.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? 'No se encontraron ventas' : 'No hay ventas no registradas'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Todas las ventas han sido registradas correctamente'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
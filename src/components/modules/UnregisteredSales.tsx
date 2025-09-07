import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Search, AlertTriangle, RefreshCw, Trash2,
  WifiOff, Database, Clock, CheckCircle, X
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

// Mock unregistered sales data
const MOCK_UNREGISTERED_SALES = [
  {
    id: 'US001',
    date: '2024-01-15',
    time: '14:30:25',
    client: 'María García',
    items: [
      { name: 'Ensalada César', quantity: 2, price: 12.50 },
      { name: 'Jugo Natural', quantity: 1, price: 6.00 }
    ],
    total: 31.00,
    paymentMethod: 'efectivo',
    user: 'Cajero Principal',
    errorType: 'network',
    errorMessage: 'Error de conexión - No se pudo sincronizar con RTDB',
    attempts: 3,
    canRetry: true
  },
  {
    id: 'US002',
    date: '2024-01-15',
    time: '15:45:12',
    client: 'Carlos Ruiz',
    items: [
      { name: 'Wrap de Pollo', quantity: 1, price: 14.00 }
    ],
    total: 14.00,
    paymentMethod: 'credito',
    user: 'Administrador',
    errorType: 'correlative',
    errorMessage: 'Error de correlativo duplicado - B001-00045 ya existe',
    attempts: 1,
    canRetry: true
  },
  {
    id: 'US003',
    date: '2024-01-15',
    time: '12:15:33',
    client: 'Ana López',
    items: [
      { name: 'Bowl de Quinoa', quantity: 1, price: 16.00 }
    ],
    total: 16.00,
    paymentMethod: 'transferencia',
    user: 'Cajero Principal',
    errorType: 'validation',
    errorMessage: 'Error de validación - Cliente no encontrado en base de datos',
    attempts: 2,
    canRetry: false
  }
];

interface UnregisteredSalesProps {
  onBack: () => void;
}

export const UnregisteredSales = ({ onBack }: UnregisteredSalesProps) => {
  const [unregisteredSales, setUnregisteredSales] = useState(MOCK_UNREGISTERED_SALES);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingIds, setProcessingIds] = useState<string[]>([]);

  const filteredSales = unregisteredSales.filter(sale =>
    sale.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.errorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return <WifiOff className="w-4 h-4" />;
      case 'correlative':
        return <Database className="w-4 h-4" />;
      case 'validation':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getErrorBadgeColor = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return "bg-warning text-warning-foreground";
      case 'correlative':
        return "bg-destructive text-destructive-foreground";
      case 'validation':
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const retryRegistration = async (saleId: string) => {
    setProcessingIds(prev => [...prev, saleId]);
    
    // Simulate retry process
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success (70% chance)
      if (Math.random() > 0.3) {
        setUnregisteredSales(prev => prev.filter(sale => sale.id !== saleId));
        console.log('Sale registered successfully:', saleId);
      } else {
        // Simulate failure - increment attempts
        setUnregisteredSales(prev => prev.map(sale => 
          sale.id === saleId 
            ? { ...sale, attempts: sale.attempts + 1 }
            : sale
        ));
        console.log('Retry failed for sale:', saleId);
      }
    } catch (error) {
      console.error('Error retrying sale registration:', error);
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== saleId));
    }
  };

  const deleteSale = (saleId: string) => {
    setUnregisteredSales(prev => prev.filter(sale => sale.id !== saleId));
  };

  const retryAllPossible = async () => {
    const retryableSales = unregisteredSales.filter(sale => sale.canRetry);
    
    for (const sale of retryableSales) {
      if (!processingIds.includes(sale.id)) {
        await retryRegistration(sale.id);
      }
    }
  };

  const errorTypeStats = {
    network: unregisteredSales.filter(s => s.errorType === 'network').length,
    correlative: unregisteredSales.filter(s => s.errorType === 'correlative').length,
    validation: unregisteredSales.filter(s => s.errorType === 'validation').length
  };

  const totalAmount = unregisteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const retryableCount = unregisteredSales.filter(sale => sale.canRetry).length;

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
            <h1 className="text-2xl font-bold text-foreground">Ventas No Registradas</h1>
          </div>

          {retryableCount > 0 && (
            <Button onClick={retryAllPossible} disabled={processingIds.length > 0}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar Todas ({retryableCount})
            </Button>
          )}
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total No Registradas</CardTitle>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {unregisteredSales.length}
              </div>
              <p className="text-xs text-muted-foreground">
                S/ {totalAmount.toFixed(2)} en ventas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errores de Red</CardTitle>
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {errorTypeStats.network}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errores de Correlativo</CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {errorTypeStats.correlative}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errores de Validación</CardTitle>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {errorTypeStats.validation}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por cliente, ID o tipo de error..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Unregistered Sales List */}
        <div className="space-y-4">
          {filteredSales.map((sale) => (
            <Card key={sale.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold text-lg">{sale.id}</h3>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {sale.date} - {sale.time}
                      </p>
                    </div>
                    <Badge className={getErrorBadgeColor(sale.errorType)}>
                      {getErrorIcon(sale.errorType)}
                      <span className="ml-1 capitalize">{sale.errorType}</span>
                    </Badge>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      S/ {sale.total.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.attempts} intento(s)
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-1">Error:</p>
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {sale.errorMessage}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-medium">Cliente:</span>
                    <p className="text-sm">{sale.client}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Pago:</span>
                    <p className="text-sm capitalize">{sale.paymentMethod}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Vendedor:</span>
                    <p className="text-sm">{sale.user}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="mb-4">
                  <span className="text-sm font-medium">Productos:</span>
                  <ul className="mt-2 space-y-1">
                    {sale.items.map((item, index) => (
                      <li key={index} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span>S/ {(item.quantity * item.price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {sale.canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryRegistration(sale.id)}
                        disabled={processingIds.includes(sale.id)}
                      >
                        {processingIds.includes(sale.id) ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Reintentar
                          </>
                        )}
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                            ¿Eliminar venta no registrada?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La venta {sale.id} será eliminada permanentemente y no se podrá recuperar.
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

                  {!sale.canRetry && (
                    <Badge variant="secondary">
                      <X className="w-3 h-3 mr-1" />
                      No se puede reintentar
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {unregisteredSales.length === 0 ? 'No hay ventas no registradas' : 'No se encontraron resultados'}
            </h3>
            <p className="text-muted-foreground">
              {unregisteredSales.length === 0 ? 
                'Todas las ventas se han registrado correctamente' : 
                'Intenta con otros términos de búsqueda'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
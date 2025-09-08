import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Search, Download, CheckCircle2, Users,
  Calendar, FileText, Phone, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

interface CollectionItem {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  urgentCollection: boolean;
  collected: boolean;
}

interface CollectionChecklistProps {
  onBack: () => void;
}

export const CollectionChecklist = ({ onBack }: CollectionChecklistProps) => {
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [collections, setCollections] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate] = useState(new Date());

  // Load collection data from RTDB
  const loadCollectionItems = async () => {
    try {
      const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
      if (arData) {
        return Object.values(arData).filter((item: any) => item.debt > 0);
      }
      return [];
    } catch (error) {
      console.error('Error loading collection items:', error);
      return [];
    }
  };

  useEffect(() => {
    loadCollectionItems().then(items => {
      setCollectionItems(items);
    });
  }, []);

  const loadCollections = async () => {
    try {
      const collectionsPath = `collections/${format(selectedDate, 'yyyy-MM-dd')}`;
      const todayCollections = await RTDBHelper.getData(collectionsPath) || {};
      setCollections(todayCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const toggleCollection = async (clientId: string, collected: boolean) => {
    try {
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const collectionPath = `collections/${dateKey}/${clientId}`;
      
      if (collected) {
        await RTDBHelper.setData(collectionPath, {
          collected: true,
          collectedAt: new Date().toISOString(),
          collectedBy: 'current-user' // Replace with actual user from auth context
        });
      } else {
        await RTDBHelper.removeData(collectionPath);
      }
      
      setCollections(prev => ({
        ...prev,
        [clientId]: collected
      }));
      
      // Update local state
      setCollectionItems(items => 
        items.map(item => 
          item.id === clientId ? { ...item, collected } : item
        )
      );
    } catch (error) {
      console.error('Error updating collection status:', error);
    }
  };

  const exportToCSV = () => {
    const csvData = collectionItems.map(item => ({
      Cliente: item.name,
      Telefono: item.phone,
      Deuda: item.totalDebt,
      Urgente: item.urgentCollection ? 'Sí' : 'No',
      Cobrado: collections[item.id] ? 'Sí' : 'No',
      Fecha: format(selectedDate, 'dd/MM/yyyy')
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cobranzas_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = collectionItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone.includes(searchTerm)
  );

  const totalPending = filteredItems.filter(item => !collections[item.id]).length;
  const totalCollected = filteredItems.filter(item => collections[item.id]).length;
  const totalAmount = filteredItems.reduce((sum, item) => sum + item.totalDebt, 0);
  const collectedAmount = filteredItems
    .filter(item => collections[item.id])
    .reduce((sum, item) => sum + item.totalDebt, 0);

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
            <CheckCircle2 className="h-6 w-6" />
            Lista de Cobranza - {format(selectedDate, 'dd/MM/yyyy', { locale: es })}
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{totalPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Cobrados</p>
                  <p className="text-2xl font-bold">{totalCollected}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Monto Total</p>
                <p className="text-2xl font-bold">S/ {totalAmount.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Cobrado Hoy</p>
                <p className="text-2xl font-bold text-green-600">S/ {collectedAmount.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Collection List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes con Deudas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    collections[item.id] ? 'bg-green-50 border-green-200' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={collections[item.id] || false}
                      onCheckedChange={(checked) => toggleCollection(item.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.name}</h3>
                        {item.urgentCollection && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            URGENTE
                          </Badge>
                        )}
                        {collections[item.id] && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            COBRADO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {item.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">S/ {item.totalDebt.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron clientes</h3>
                <p className="text-muted-foreground">No hay clientes con deudas pendientes para esta fecha</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
// Collection checklist component for tracking daily collections
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Search, Download, Users, DollarSign,
  CheckCircle, Clock, Calendar
} from 'lucide-react';
import { RTDBHelper } from '@/lib/rt';
import { RTDB_PATHS } from '@/lib/rtdb';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [collections, setCollections] = useState<Record<string, boolean>>({});

  // Mock data - replace with RTDB data
  const MOCK_COLLECTION_ITEMS: CollectionItem[] = [
    {
      id: 'C001',
      name: 'María García López',
      phone: '987654321',
      totalDebt: 45.50,
      urgentCollection: true,
      collected: false
    },
    {
      id: 'C002',
      name: 'Carlos Ruiz Mendoza',
      phone: '987654322',
      totalDebt: 80.00,
      urgentCollection: false,
      collected: false
    },
    {
      id: 'C003',
      name: 'Ana López Silva',
      phone: '987654323',
      totalDebt: 18.00,
      urgentCollection: false,
      collected: false
    }
  ];

  useEffect(() => {
    setCollectionItems(MOCK_COLLECTION_ITEMS);
    loadCollections();
  }, [selectedDate]);

  const loadCollections = async () => {
    try {
      const collectionsPath = `collections/${selectedDate}`;
      const todayCollections = await RTDBHelper.getData(collectionsPath) || {};
      setCollections(todayCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const toggleCollection = async (clientId: string) => {
    const newStatus = !collections[clientId];
    const updatedCollections = {
      ...collections,
      [clientId]: newStatus
    };

    setCollections(updatedCollections);

    try {
      const collectionsPath = `collections/${selectedDate}`;
      await RTDBHelper.setData(collectionsPath, updatedCollections);
    } catch (error) {
      console.error('Error saving collection status:', error);
    }
  };

  const exportToCSV = () => {
    const csvData = collectionItems.map(item => ({
      'ID Cliente': item.id,
      'Nombre': item.name,
      'Teléfono': item.phone,
      'Deuda Total': item.totalDebt.toFixed(2),
      'Urgente': item.urgentCollection ? 'Sí' : 'No',
      'Cobrado': collections[item.id] ? 'Sí' : 'No',
      'Fecha': selectedDate
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobranza_${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredItems = collectionItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = filteredItems.reduce((sum, item) => sum + item.totalDebt, 0);
  const collectedCount = filteredItems.filter(item => collections[item.id]).length;
  const pendingCount = filteredItems.length - collectedCount;

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
            <h1 className="text-2xl font-bold text-foreground">Ruta de Cobranza</h1>
          </div>

          <div className="flex items-center space-x-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredItems.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobrados Hoy</CardTitle>
              <CheckCircle className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{collectedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deuda</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">S/ {totalDebt.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Date and Search */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">
              Cobranza del {new Date(selectedDate).toLocaleDateString()}
            </span>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Collection List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Cobranza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <Checkbox
                      checked={collections[item.id] || false}
                      onCheckedChange={() => toggleCollection(item.id)}
                      className="w-5 h-5"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{item.name}</h3>
                        {item.urgentCollection && (
                          <Badge variant="destructive" className="text-xs">Urgente</Badge>
                        )}
                        {collections[item.id] && (
                          <Badge variant="default" className="text-xs bg-success">Cobrado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.id} • {item.phone}
                      </p>
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
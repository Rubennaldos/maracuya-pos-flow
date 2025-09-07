import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Search, Plus, Edit, Trash2, Users,
  Phone, GraduationCap, CreditCard, User
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Mock clients data
const MOCK_CLIENTS: Client[] = [
  {
    id: 'C001',
    names: 'María',
    lastNames: 'García López',
    parentPhone: '987654321',
    responsiblePhone: '987654321',
    classroom: '3A',
    grade: '3',
    level: 'primaria',
    hasAccount: true,
    isActive: true,
    debt: 45.50
  },
  {
    id: 'C002',
    names: 'Carlos',
    lastNames: 'Ruiz Mendoza',
    parentPhone: '987654322',
    responsiblePhone: '987654322',
    classroom: '5B',
    grade: '5',
    level: 'primaria',
    hasAccount: true,
    isActive: true,
    debt: 0
  },
  {
    id: 'C003',
    names: 'Ana',
    lastNames: 'López Silva',
    parentPhone: '987654323',
    responsiblePhone: '987654323',
    classroom: '2A',
    grade: '2',
    level: 'primaria',
    hasAccount: false,
    isActive: true,
    debt: 0
  },
  {
    id: 'VARIOS',
    names: 'Clientes',
    lastNames: 'Varios',
    parentPhone: '',
    responsiblePhone: '',
    classroom: '',
    grade: '',
    level: '',
    hasAccount: false,
    isActive: true,
    debt: 0
  }
];

interface Client {
  id: string;
  names: string;
  lastNames: string;
  parentPhone: string;
  responsiblePhone: string;
  classroom: string;
  grade: string;
  level: 'primaria' | 'secundaria' | '';
  hasAccount: boolean;
  isActive: boolean;
  debt: number;
}

interface ClientsProps {
  onBack: () => void;
}

export const Clients = ({ onBack }: ClientsProps) => {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    names: '',
    lastNames: '',
    parentPhone: '',
    responsiblePhone: '',
    classroom: '',
    grade: '',
    level: 'primaria',
    hasAccount: false,
    isActive: true,
    debt: 0
  });

  const filteredClients = clients.filter(client =>
    client.names.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.lastNames.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.classroom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateClientId = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `C${timestamp}`;
  };

  const saveClient = () => {
    if (editingClient) {
      // Edit existing client
      setClients(prev => prev.map(c => 
        c.id === editingClient.id 
          ? { ...newClient as Client, id: editingClient.id }
          : c
      ));
      setEditingClient(null);
    } else {
      // Create new client
      const client: Client = {
        ...newClient as Client,
        id: generateClientId(),
        debt: 0
      };
      setClients(prev => [...prev, client]);
    }
    
    resetForm();
    setIsCreateDialogOpen(false);
  };

  const resetForm = () => {
    setNewClient({
      names: '',
      lastNames: '',
      parentPhone: '',
      responsiblePhone: '',
      classroom: '',
      grade: '',
      level: 'primaria',
      hasAccount: false,
      isActive: true,
      debt: 0
    });
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setNewClient(client);
    setIsCreateDialogOpen(true);
  };

  const toggleClientStatus = (clientId: string) => {
    setClients(prev => prev.map(c => 
      c.id === clientId ? { ...c, isActive: !c.isActive } : c
    ));
  };

  const deleteClient = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  const getGradeBadgeColor = (grade: string) => {
    const gradeNum = parseInt(grade);
    if (gradeNum <= 3) return "bg-success text-success-foreground";
    if (gradeNum <= 6) return "bg-warning text-warning-foreground";
    return "bg-primary text-primary-foreground";
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
            <h1 className="text-2xl font-bold text-foreground">Gestión de Clientes</h1>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingClient(null);
                resetForm();
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="names">Nombres</Label>
                    <Input
                      id="names"
                      value={newClient.names}
                      onChange={(e) => setNewClient(prev => ({ ...prev, names: e.target.value }))}
                      placeholder="Ej: María"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastNames">Apellidos</Label>
                    <Input
                      id="lastNames"
                      value={newClient.lastNames}
                      onChange={(e) => setNewClient(prev => ({ ...prev, lastNames: e.target.value }))}
                      placeholder="Ej: García López"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="parentPhone">Teléfono de Padres</Label>
                    <Input
                      id="parentPhone"
                      value={newClient.parentPhone}
                      onChange={(e) => setNewClient(prev => ({ ...prev, parentPhone: e.target.value }))}
                      placeholder="987654321"
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsiblePhone">Teléfono de Responsable</Label>
                    <Input
                      id="responsiblePhone"
                      value={newClient.responsiblePhone}
                      onChange={(e) => setNewClient(prev => ({ ...prev, responsiblePhone: e.target.value }))}
                      placeholder="987654321"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="level">Nivel Educativo</Label>
                  <Select value={newClient.level} onValueChange={(value: 'primaria' | 'secundaria') => 
                    setNewClient(prev => ({ ...prev, level: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primaria">Primaria</SelectItem>
                      <SelectItem value="secundaria">Secundaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">Grado</Label>
                    <Input
                      id="grade"
                      value={newClient.grade}
                      onChange={(e) => setNewClient(prev => ({ ...prev, grade: e.target.value }))}
                      placeholder="Ej: 3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="classroom">Salón</Label>
                    <Input
                      id="classroom"
                      value={newClient.classroom}
                      onChange={(e) => setNewClient(prev => ({ ...prev, classroom: e.target.value }))}
                      placeholder="Ej: 3A"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasAccount"
                    checked={newClient.hasAccount}
                    onCheckedChange={(checked) => setNewClient(prev => ({ ...prev, hasAccount: checked }))}
                  />
                  <Label htmlFor="hasAccount">¿Tiene cuenta de crédito?</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newClient.isActive}
                    onCheckedChange={(checked) => setNewClient(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Cliente Activo</Label>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button onClick={saveClient} className="flex-1">
                    {editingClient ? 'Actualizar' : 'Crear'} Cliente
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="p-6">
        {/* Search */}
        <div className="mb-6">
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Con Cuenta</p>
                  <p className="text-2xl font-bold">{clients.filter(c => c.hasAccount).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Primaria</p>
                  <p className="text-2xl font-bold">{clients.filter(c => c.level === 'primaria').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-secondary" />
                <div>
                  <p className="text-sm text-muted-foreground">Secundaria</p>
                  <p className="text-2xl font-bold">{clients.filter(c => c.level === 'secundaria').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className={`transition-all duration-200 ${!client.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {client.names} {client.lastNames}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {client.id}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.id !== 'VARIOS' && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{client.parentPhone}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{client.classroom}</span>
                      </div>
                      <Badge className={getGradeBadgeColor(client.grade)}>
                        {client.grade}° {client.level}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {client.hasAccount ? 'Con cuenta' : 'Sin cuenta'}
                        </span>
                      </div>
                      {client.debt > 0 && (
                        <Badge variant="destructive">
                          Debe S/ {client.debt.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </>
                )}

                {client.id === 'VARIOS' && (
                  <div className="text-center py-4">
                    <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Cliente especial para ventas al contado</p>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  {client.id !== 'VARIOS' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(client)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El cliente "{client.names} {client.lastNames}" será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteClient(client.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron clientes</h3>
            <p className="text-muted-foreground">Intenta con otros términos de búsqueda</p>
          </div>
        )}
      </div>
    </div>
  );
};
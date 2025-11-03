// src/components/modules/Clients.tsx
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Phone,
  GraduationCap,
  CreditCard,
  User,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Archive,
  RotateCcw,
  Trash,
} from "lucide-react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import * as XLSX from "xlsx";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** ===================== Tipos ===================== **/
interface Client {
  id: string;
  names: string;
  lastNames: string;
  payer1Name: string;
  payer1Phone: string;
  payer2Name?: string;
  payer2Phone?: string;
  classroom: string;
  grade: string;
  level: "kinder" | "primaria" | "secundaria" | "";
  hasAccount: boolean;
  isActive: boolean;
  debt: number;
  isStaff?: boolean;
  staffType?: "docente" | "administrativo" | null;
  personalEmail?: string;
  personalPhone?: string;
}

interface ClientsProps {
  onBack: () => void;
}

/** Mapeos útiles */
const LEVEL_LABEL: Record<Exclude<Client["level"], "">, string> = {
  kinder: "Kinder",
  primaria: "Primaria",
  secundaria: "Secundaria",
};

const LEVEL_OPTIONS: { value: Exclude<Client["level"], "">; label: string }[] = [
  { value: "kinder", label: "Kinder" },
  { value: "primaria", label: "Primaria" },
  { value: "secundaria", label: "Secundaria" },
];

/** ===================== Componente ===================== **/
export const Clients = ({ onBack }: ClientsProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [clientDebts, setClientDebts] = useState<Record<string, number>>({});
  const [showDeletedClients, setShowDeletedClients] = useState(false);
  const [deletedClients, setDeletedClients] = useState<Array<{client: Client, deletedAt: number, deletedBy?: string}>>([]);

  // Load client debts from accounts_receivable
  const loadClientDebts = async () => {
    try {
      const arData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.accounts_receivable);
      if (!arData) return {};

      const debts: Record<string, number> = {};

      // Calcular deuda por cliente
      Object.entries(arData).forEach(([clientId, clientData]) => {
        const cData = clientData as any;
        if (cData && typeof cData === "object" && cData.entries) {
          let totalDebt = 0;
          Object.values(cData.entries).forEach((entry: any) => {
            if (entry?.status === "pending") {
              const amount = Number(entry.amount || 0);
              const paidAmount = Number(entry.paidAmount || 0);
              totalDebt += (amount - paidAmount);
            }
          });
          if (totalDebt > 0) {
            debts[clientId] = totalDebt;
          }
        }
      });

      // Formato legado/plano
      Object.entries(arData).forEach(([key, value]) => {
        const flat = value as any;
        const looksEntry = flat && typeof flat === "object" && flat.status && (flat.amount !== undefined) && !flat.entries;
        
        if (looksEntry && flat.status === "pending") {
          const clientId = flat.clientId || "varios";
          const amount = Number(flat.amount || 0);
          const paidAmount = Number(flat.paidAmount || 0);
          const remainingAmount = amount - paidAmount;
          
          if (remainingAmount > 0) {
            debts[clientId] = (debts[clientId] || 0) + remainingAmount;
          }
        }
      });

      return debts;
    } catch (error) {
      console.error("Error loading client debts:", error);
      return {};
    }
  };

  // Load clients from RTDB
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const [clientsData, debtsData] = await Promise.all([
        RTDBHelper.getData<Record<string, Client>>(RTDB_PATHS.clients),
        loadClientDebts()
      ]);
      
      if (clientsData) {
        const clientsArray = Object.entries(clientsData).map(([id, client]) => ({
          ...client,
          id
        }));
        setClients(clientsArray);
      }
      
      setClientDebts(debtsData);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    names: "",
    lastNames: "",
    payer1Name: "",
    payer1Phone: "",
    payer2Name: "",
    payer2Phone: "",
    classroom: "",
    grade: "",
    level: "primaria",
    hasAccount: false,
    isActive: true,
    debt: 0,
    isStaff: false,
    staffType: null,
    personalEmail: "",
    personalPhone: "",
  });

  // 🔒 Coherencia automática para personal
  useEffect(() => {
    setNewClient((prev) => {
      if (!prev) return prev;
      if (prev.isStaff) {
        return {
          ...prev,
          level: "",
          grade: "",
          classroom: "",
          hasAccount: false,
        };
      } else {
        // si no es staff y no hay nivel, default a primaria
        const lvl =
          (prev.level && (prev.level as "kinder" | "primaria" | "secundaria")) || "primaria";
        return { ...prev, level: lvl };
      }
    });
  }, [newClient.isStaff]);

  // Detectar duplicados
  const duplicateGroups = useMemo(() => {
    const nameMap = new Map<string, Client[]>();
    clients.forEach(client => {
      const fullName = `${client.names} ${client.lastNames}`.trim().toUpperCase();
      if (!nameMap.has(fullName)) {
        nameMap.set(fullName, []);
      }
      nameMap.get(fullName)!.push(client);
    });
    
    // Solo retornar grupos con más de 1 cliente
    return Array.from(nameMap.entries())
      .filter(([_, group]) => group.length > 1)
      .map(([name, group]) => ({ name, clients: group }));
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (showDuplicates) {
      // Mostrar solo clientes duplicados
      const duplicateIds = new Set(
        duplicateGroups.flatMap(g => g.clients.map(c => c.id))
      );
      return clients.filter(c => duplicateIds.has(c.id));
    }
    
    return clients.filter(
      (client) =>
        client.names.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.lastNames.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.classroom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm, showDuplicates, duplicateGroups]);

  const generateClientId = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `C${timestamp}`;
  };

  const normalizeForSave = (data: Partial<Client>): Client => {
    const base: Client = {
      id: editingClient?.id ?? generateClientId(),
      names: data.names || "",
      lastNames: data.lastNames || "",
      payer1Name: data.payer1Name || "",
      payer1Phone: data.payer1Phone || "",
      payer2Name: data.payer2Name || "",
      payer2Phone: data.payer2Phone || "",
      classroom: data.classroom || "",
      grade: data.grade || "",
      level: (data.level ?? "") as Client["level"],
      hasAccount: Boolean(data.hasAccount),
      isActive: data.isActive ?? true,
      debt: data.debt ?? 0,
      isStaff: Boolean(data.isStaff),
      staffType: (data.staffType ?? null) as Client["staffType"],
      personalEmail: data.personalEmail || "",
      personalPhone: data.personalPhone || "",
    };

    if (base.isStaff) {
      base.level = "";
      base.grade = "";
      base.classroom = "";
      base.hasAccount = false;
    }

    return base;
  };

  const saveClient = async () => {
    try {
      if (editingClient) {
        const updatedClient = normalizeForSave({ ...newClient, id: editingClient.id });
        await RTDBHelper.setData(`${RTDB_PATHS.clients}/${editingClient.id}`, updatedClient);
        setClients((prev) => prev.map((c) => (c.id === editingClient.id ? updatedClient : c)));
        setEditingClient(null);
      } else {
        const client = normalizeForSave(newClient);
        await RTDBHelper.setData(`${RTDB_PATHS.clients}/${client.id}`, client);
        setClients((prev) => [...prev, client]);
      }

      resetForm();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error saving client:", error);
    }
  };

  const resetForm = () => {
    setNewClient({
      names: "",
      lastNames: "",
      payer1Name: "",
      payer1Phone: "",
      payer2Name: "",
      payer2Phone: "",
      classroom: "",
      grade: "",
      level: "primaria",
      hasAccount: false,
      isActive: true,
      debt: 0,
      isStaff: false,
      staffType: null,
      personalEmail: "",
      personalPhone: "",
    });
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setNewClient(client);
    setIsCreateDialogOpen(true);
  };

  const toggleClientStatus = async (clientId: string) => {
    try {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        const updatedClient = { ...client, isActive: !client.isActive };
        await RTDBHelper.setData(`${RTDB_PATHS.clients}/${clientId}`, updatedClient);
        setClients((prev) => prev.map((c) => (c.id === clientId ? updatedClient : c)));
      }
    } catch (error) {
      console.error("Error updating client status:", error);
    }
  };

  const deleteClient = async (clientId: string) => {
    try {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;

      // Mover a deleted_clients en vez de borrar permanentemente
      const deletedData = {
        client,
        deletedAt: Date.now(),
        deletedBy: "admin", // Aquí podrías poner el usuario actual
      };
      
      await RTDBHelper.setData(`deleted_clients/${clientId}`, deletedData);
      await RTDBHelper.removeData(`${RTDB_PATHS.clients}/${clientId}`);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      
      alert(`Cliente ${client.names} ${client.lastNames} movido a papelera. Puede recuperarlo desde el botón "Ver Clientes Borrados".`);
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Error al eliminar cliente");
    }
  };

  const getGradeBadgeColor = (grade: string) => {
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum)) return "bg-muted text-foreground";
    if (gradeNum <= 3) return "bg-success text-success-foreground";
    if (gradeNum <= 6) return "bg-warning text-warning-foreground";
    return "bg-primary text-primary-foreground";
  };

  const downloadTemplate = () => {
    const template = [
      {
        Nombres: "María",
        Apellidos: "García López",
        Responsable1_Nombre: "Juan García",
        Responsable1_Telefono: "987654321",
        Responsable2_Nombre: "Ana López",
        Responsable2_Telefono: "987654322",
        Grado: "3",
        Salon: "3A",
        Nivel: "primaria", // kinder | primaria | secundaria
        Tiene_Cuenta: "SI",
        Esta_Activo: "SI",
        Es_Personal: "NO",
        Tipo_Personal: "",
        Email_Personal: "",
        Telefono_Personal: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Clientes");

    // Auto-width columns
    const colWidths = Object.keys(template[0]).map((key) => ({ wch: Math.max(key.length, 15) }));
    (ws as any)["!cols"] = colWidths;

    XLSX.writeFile(wb, "plantilla_clientes.xlsx");
  };

  const parseNivel = (raw: any): Client["level"] => {
    const v = String(raw || "").trim().toLowerCase();
    if (v === "kinder") return "kinder";
    if (v === "secundaria") return "secundaria";
    if (v === "primaria") return "primaria";
    return "primaria"; // default si viene raro
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        const errors: string[] = [];

        for (const row of jsonData as any[]) {
          try {
            if (!row.Nombres || !row.Apellidos) {
              errors.push(`Fila sin nombre completo: ${JSON.stringify(row)}`);
              continue;
            }

            const newClient: Client = {
              id: generateClientId(),
              names: row.Nombres?.toString() || "",
              lastNames: row.Apellidos?.toString() || "",
              payer1Name: row.Responsable1_Nombre?.toString() || "",
              payer1Phone: row.Responsable1_Telefono?.toString() || "",
              payer2Name: row.Responsable2_Nombre?.toString() || "",
              payer2Phone: row.Responsable2_Telefono?.toString() || "",
              classroom: row.Salon?.toString() || "",
              grade: row.Grado?.toString() || "",
              level: parseNivel(row.Nivel),
              hasAccount: row.Tiene_Cuenta?.toString().toUpperCase() === "SI",
              isActive: row.Esta_Activo?.toString().toUpperCase() === "SI",
              debt: 0,
              isStaff: row.Es_Personal?.toString().toUpperCase() === "SI",
              staffType:
                row.Tipo_Personal?.toString().toLowerCase() === "administrativo"
                  ? "administrativo"
                  : row.Tipo_Personal?.toString().toLowerCase() === "docente"
                  ? "docente"
                  : null,
              personalEmail: row.Email_Personal?.toString() || "",
              personalPhone: row.Telefono_Personal?.toString() || "",
            };

            // Normalización post-import para personal
            if (newClient.isStaff) {
              newClient.level = "";
              newClient.grade = "";
              newClient.classroom = "";
              newClient.hasAccount = false;
            }

            // Save to RTDB
            await RTDBHelper.setData(`${RTDB_PATHS.clients}/${newClient.id}`, newClient);
            importedCount++;
          } catch (error) {
            errors.push(
              `Error procesando fila: ${row.Nombres} ${row.Apellidos} - ${String(error)}`
            );
          }
        }

        // Reload clients
        await loadClients();

        alert(
          `Importación completada:\n- ${importedCount} clientes importados\n${
            errors.length > 0 ? `- ${errors.length} errores encontrados` : ""
          }`
        );

        if (errors.length > 0) {
          console.error("Errores de importación:", errors);
        }
      } catch (error) {
        console.error("Error importing file:", error);
        alert("Error al procesar el archivo. Verifique que sea un archivo Excel válido.");
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input
    (event.target as HTMLInputElement).value = "";
  };

  /** ================== CLIENTES BORRADOS ================== */
  const loadDeletedClients = async () => {
    try {
      const data = await RTDBHelper.getData<Record<string, any>>("deleted_clients");
      if (!data) {
        setDeletedClients([]);
        return;
      }
      
      const deletedList = Object.entries(data).map(([id, entry]) => ({
        client: { ...entry.client, id } as Client,
        deletedAt: entry.deletedAt || Date.now(),
        deletedBy: entry.deletedBy || "unknown",
      }));
      
      // Ordenar por fecha de eliminación, más recientes primero
      deletedList.sort((a, b) => b.deletedAt - a.deletedAt);
      setDeletedClients(deletedList);
    } catch (error) {
      console.error("Error loading deleted clients:", error);
      setDeletedClients([]);
    }
  };

  const restoreClient = async (clientId: string) => {
    try {
      const deletedEntry = deletedClients.find(d => d.client.id === clientId);
      if (!deletedEntry) return;

      // Restaurar cliente a la lista activa
      await RTDBHelper.setData(`${RTDB_PATHS.clients}/${clientId}`, deletedEntry.client);
      await RTDBHelper.removeData(`deleted_clients/${clientId}`);
      
      // Actualizar estados
      setClients((prev) => [...prev, deletedEntry.client]);
      setDeletedClients((prev) => prev.filter(d => d.client.id !== clientId));
      
      alert(`Cliente ${deletedEntry.client.names} ${deletedEntry.client.lastNames} restaurado exitosamente.`);
    } catch (error) {
      console.error("Error restoring client:", error);
      alert("Error al restaurar cliente");
    }
  };

  const permanentlyDeleteClient = async (clientId: string) => {
    try {
      await RTDBHelper.removeData(`deleted_clients/${clientId}`);
      setDeletedClients((prev) => prev.filter(d => d.client.id !== clientId));
      alert("Cliente eliminado permanentemente.");
    } catch (error) {
      console.error("Error permanently deleting client:", error);
      alert("Error al eliminar permanentemente");
    }
  };

  useEffect(() => {
    if (showDeletedClients) {
      loadDeletedClients();
    }
  }, [showDeletedClients]);

  /** ================== EXPORTAR TODOS LOS CLIENTES A EXCEL ================== */
  const handleExportAllClients = async () => {
    try {
      // Traemos TODO directamente de RTDB (no solo filtrados/visibles)
      const data = await RTDBHelper.getData<Record<string, Client>>(RTDB_PATHS.clients);
      const list: Client[] = Object.values(data || {});

      if (!list.length) {
        alert("No hay clientes para exportar.");
        return;
      }

      // Orden por nombre completo
      list.sort((a, b) =>
        `${a.names} ${a.lastNames}`.localeCompare(`${b.names} ${b.lastNames}`, "es", {
          sensitivity: "base",
        })
      );

      // Mapeo de filas con cabeceras amigables
      const rows = list.map((c) => ({
        ID: c.id || "",
        Nombres: c.names || "",
        Apellidos: c.lastNames || "",
        Responsable1_Nombre: c.payer1Name || "",
        Responsable1_Telefono: c.payer1Phone || "",
        Responsable2_Nombre: c.payer2Name || "",
        Responsable2_Telefono: c.payer2Phone || "",
        Nivel: c.isStaff ? "" : c.level || "",
        Grado: c.isStaff ? "" : c.grade || "",
        Salon: c.isStaff ? "" : c.classroom || "",
        Tiene_Cuenta: c.hasAccount ? "SI" : "NO",
        Esta_Activo: c.isActive ? "SI" : "NO",
        Deuda: Number(c.debt || 0),
        Es_Personal: c.isStaff ? "SI" : "NO",
        Tipo_Personal: c.isStaff ? c.staffType || "" : "",
        Email_Personal: c.isStaff ? c.personalEmail || "" : "",
        Telefono_Personal: c.isStaff ? c.personalPhone || "" : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto ancho de columnas
      const headers = Object.keys(rows[0]);
      const colWidths = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...rows.map((r) => (r[h as keyof typeof r] ? String(r[h as keyof typeof r]).length : 0))
        );
        return { wch: Math.min(Math.max(12, maxLen + 2), 40) };
      });
      (ws as any)["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");
      XLSX.writeFile(wb, "clientes.xlsx");
    } catch (e) {
      console.error(e);
      alert("No se pudo exportar los clientes.");
    }
  };

  /** ===================== Render ===================== **/
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

          <div className="flex items-center space-x-2">
            <Sheet open={showDeletedClients} onOpenChange={setShowDeletedClients}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Archive className="w-4 h-4 mr-2" />
                  Ver Clientes Borrados
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Clientes Eliminados</SheetTitle>
                  <SheetDescription>
                    Aquí puedes ver y restaurar clientes que fueron eliminados.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                  {deletedClients.length === 0 ? (
                    <div className="text-center py-12">
                      <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay clientes eliminados</p>
                    </div>
                  ) : (
                    deletedClients.map((entry) => {
                      const c = entry.client;
                      const debt = clientDebts[c.id] || 0;
                      return (
                        <Card key={c.id}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {c.names} {c.lastNames}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">ID: {c.id}</p>
                                </div>
                                <Badge variant="outline">{c.classroom}</Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Teléfono:</span>
                                  <p className="font-medium">{c.payer1Phone || "N/A"}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Nivel:</span>
                                  <p className="font-medium">{c.level || "N/A"}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Deuda Real:</span>
                                  <p className={`font-semibold ${debt > 0 ? 'text-destructive' : 'text-success'}`}>
                                    S/ {debt.toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Cuenta:</span>
                                  <p className="font-medium">{c.hasAccount ? "Sí" : "No"}</p>
                                </div>
                              </div>

                              <div className="text-xs text-muted-foreground border-t pt-2">
                                Eliminado: {new Date(entry.deletedAt).toLocaleString("es-PE")}
                              </div>

                              <div className="flex gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  className="flex-1"
                                  onClick={() => restoreClient(c.id)}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Restaurar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <Trash className="w-4 h-4 mr-2" />
                                      Eliminar Permanentemente
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción es irreversible. El cliente {c.names} {c.lastNames} será eliminado para siempre.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => permanentlyDeleteClient(c.id)}>
                                        Eliminar Permanentemente
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Descargar Plantilla
            </Button>

            {/* NUEVO: Exportar Excel de todos los clientes */}
            <Button variant="outline" onClick={handleExportAllClients}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileImport}
              style={{ display: "none" }}
              id="file-import"
            />
            <Button variant="outline" onClick={() => document.getElementById("file-import")?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Importar Excel
            </Button>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingClient(null);
                    resetForm();
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingClient ? "Editar Cliente" : "Crear Nuevo Cliente"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="names">Nombres</Label>
                      <Input
                        id="names"
                        value={newClient.names}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, names: e.target.value }))}
                        placeholder="Ej: María"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastNames">Apellidos</Label>
                      <Input
                        id="lastNames"
                        value={newClient.lastNames}
                        onChange={(e) =>
                          setNewClient((prev) => ({ ...prev, lastNames: e.target.value }))
                        }
                        placeholder="Ej: García López"
                      />
                    </div>
                  </div>

                  {/* Staff toggle */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isStaff"
                      checked={!!newClient.isStaff}
                      onCheckedChange={(checked) =>
                        setNewClient((prev) => ({ ...prev, isStaff: checked }))
                      }
                    />
                    <Label htmlFor="isStaff">¿Es personal docente/administrativo?</Label>
                  </div>

                  {newClient.isStaff ? (
                    /* Staff fields */
                    <>
                      <div>
                        <Label>Tipo de Personal</Label>
                        <Select
                          value={newClient.staffType || ""}
                          onValueChange={(value: "docente" | "administrativo") =>
                            setNewClient((prev) => ({ ...prev, staffType: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="docente">Docente</SelectItem>
                            <SelectItem value="administrativo">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="personalEmail">Correo Personal</Label>
                          <Input
                            id="personalEmail"
                            type="email"
                            value={newClient.personalEmail}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, personalEmail: e.target.value }))
                            }
                            placeholder="ejemplo@correo.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="personalPhone">Teléfono Personal</Label>
                          <Input
                            id="personalPhone"
                            value={newClient.personalPhone}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, personalPhone: e.target.value }))
                            }
                            placeholder="987654321"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Student + responsables de pago */
                    <>
                      <div>
                        <Label htmlFor="payer1Name">Responsable de Pago 1 (Obligatorio)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="payer1Name"
                            value={newClient.payer1Name}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, payer1Name: e.target.value }))
                            }
                            placeholder="Nombre completo"
                          />
                          <Input
                            value={newClient.payer1Phone}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, payer1Phone: e.target.value }))
                            }
                            placeholder="Teléfono"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="payer2Name">Responsable de Pago 2 (Opcional)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="payer2Name"
                            value={newClient.payer2Name}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, payer2Name: e.target.value }))
                            }
                            placeholder="Nombre completo"
                          />
                          <Input
                            value={newClient.payer2Phone}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, payer2Phone: e.target.value }))
                            }
                            placeholder="Teléfono"
                          />
                        </div>
                      </div>

                      {/* Solo estudiantes: Nivel / Grado / Salón */}
                      <div>
                        <Label htmlFor="level">Nivel Educativo</Label>
                        <Select
                          value={(newClient.level as Client["level"]) || "primaria"}
                          onValueChange={(value: "kinder" | "primaria" | "secundaria") =>
                            setNewClient((prev) => ({ ...prev, level: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            {LEVEL_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="grade">Grado</Label>
                          <Input
                            id="grade"
                            value={newClient.grade}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, grade: e.target.value }))
                            }
                            placeholder="Ej: 3 (si aplica)"
                          />
                        </div>
                        <div>
                          <Label htmlFor="classroom">Salón</Label>
                          <Input
                            id="classroom"
                            value={newClient.classroom}
                            onChange={(e) =>
                              setNewClient((prev) => ({ ...prev, classroom: e.target.value }))
                            }
                            placeholder="Ej: 3A"
                          />
                        </div>
                      </div>

                      {/* Solo estudiantes: cuenta de crédito */}
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="hasAccount"
                          checked={!!newClient.hasAccount}
                          onCheckedChange={(checked) =>
                            setNewClient((prev) => ({ ...prev, hasAccount: checked }))
                          }
                        />
                        <Label htmlFor="hasAccount">¿Tiene cuenta de crédito?</Label>
                      </div>
                    </>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={!!newClient.isActive}
                      onCheckedChange={(checked) =>
                        setNewClient((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                    <Label htmlFor="isActive">Cliente Activo</Label>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button onClick={saveClient} className="flex-1">
                      {editingClient ? "Actualizar" : "Crear"} Cliente
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Alerta de duplicados */}
        {duplicateGroups.length > 0 && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <p className="text-sm font-semibold text-destructive">
                  Se detectaron {duplicateGroups.length} grupos de clientes duplicados ({duplicateGroups.reduce((acc, g) => acc + g.clients.length, 0)} registros)
                </p>
              </div>
              <Button
                variant={showDuplicates ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDuplicates(!showDuplicates)}
              >
                {showDuplicates ? "Mostrar Todos" : "Ver Duplicados"}
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats (agregamos Kinder) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.hasAccount).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-pink-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Kinder</p>
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.level === "kinder").length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.level === "primaria").length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.level === "secundaria").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const isStaff = !!client.isStaff;
            const levelKey = client.level ? (client.level as "kinder" | "primaria" | "secundaria") : null;
            const levelLabel = levelKey ? LEVEL_LABEL[levelKey] : "";
            const showBadgeText =
              !isStaff && levelLabel
                ? levelKey === "kinder"
                  ? `${levelLabel}`
                  : `${client.grade}° ${levelLabel}`
                : "";
            
            // Detectar si este cliente está duplicado
            const duplicateGroup = duplicateGroups.find(g => 
              g.clients.some(c => c.id === client.id)
            );
            const isDuplicate = !!duplicateGroup;

            return (
              <Card
                key={client.id}
                className={`transition-all duration-200 ${!client.isActive ? "opacity-60" : ""} ${isDuplicate ? "border-destructive/50" : ""}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {client.names} {client.lastNames}
                    </CardTitle>
                    <div className="flex gap-1">
                      {isDuplicate && (
                        <Badge variant="destructive" className="text-xs">
                          DUPLICADO
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {client.id}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Mostrar info de deuda y estado si es duplicado */}
                  {isDuplicate && (
                    <div className="mb-3 p-2 bg-muted/50 rounded border border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Deuda Real:</span>
                        <span className={`font-semibold ${clientDebts[client.id] && clientDebts[client.id] > 0 ? 'text-destructive' : 'text-success'}`}>
                          S/ {(clientDebts[client.id] || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">Estado:</span>
                        <span className={`font-semibold ${client.isActive ? 'text-success' : 'text-muted-foreground'}`}>
                          {client.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">Tiene cuenta:</span>
                        <span className={`font-semibold ${client.hasAccount ? 'text-primary' : 'text-muted-foreground'}`}>
                          {client.hasAccount ? 'Sí' : 'No'}
                        </span>
                      </div>
                    </div>
                  )}

                  {client.id !== "VARIOS" && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{client.payer1Phone}</span>
                      </div>

                      {/* Ocultar datos académicos para personal */}
                      {!isStaff && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <GraduationCap className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{client.classroom}</span>
                          </div>
                          {showBadgeText && (
                            <Badge className={getGradeBadgeColor(client.grade)}>
                              {showBadgeText}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          {client.hasAccount && (
                            <Badge variant="outline" className="text-xs">
                              <CreditCard className="w-3 h-3 mr-1" />
                              Cuenta
                            </Badge>
                          )}
                          {isStaff && (
                            <Badge variant="secondary" className="text-xs">
                              <User className="w-3 h-3 mr-1" />
                              {client.staffType}
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(client)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleClientStatus(client.id)}
                            className={client.isActive ? "text-warning" : "text-success"}
                          >
                            {client.isActive ? "🟢" : "🔴"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. El cliente {client.names}{" "}
                                  {client.lastNames} será eliminado permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteClient(client.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No se encontraron clientes
            </h3>
            <p className="text-muted-foreground">
              Intenta con otros términos de búsqueda o crea un nuevo cliente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

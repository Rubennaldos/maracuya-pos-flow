import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { useSession } from "@/state/session";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from "xlsx";

interface SalesImporterProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportRow {
  fecha: string;
  cliente: string;
  items: string; // JSON o formato "nombre1:cantidad1:precio1;nombre2:cantidad2:precio2"
  total: number;
  metodoPago: string;
  tipo?: string;
  vendedor?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export const SalesImporter = ({ open, onClose, onSuccess }: SalesImporterProps) => {
  const { user } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

  const downloadTemplate = () => {
    const template = [
      {
        fecha: "2024-01-15",
        cliente: "Juan Pérez",
        items: '[{"name":"Producto 1","quantity":2,"price":10.50}]',
        total: 21.00,
        metodoPago: "efectivo",
        tipo: "normal",
        vendedor: "Sistema"
      },
      {
        fecha: "2024-01-15",
        cliente: "María González",
        items: '[{"name":"Producto 2","quantity":1,"price":15.00},{"name":"Producto 3","quantity":3,"price":5.00}]',
        total: 30.00,
        metodoPago: "credito",
        tipo: "normal",
        vendedor: "Sistema"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 12 }, // fecha
      { wch: 20 }, // cliente
      { wch: 60 }, // items
      { wch: 10 }, // total
      { wch: 12 }, // metodoPago
      { wch: 10 }, // tipo
      { wch: 15 }  // vendedor
    ];

    XLSX.writeFile(wb, "plantilla_importacion_ventas.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      setErrors([{ row: 0, field: "file", message: "Solo se permiten archivos Excel (.xlsx, .xls)" }]);
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    await processFile(selectedFile);
  };

  const processFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      const validationErrors: ValidationError[] = [];
      const validRows: ImportRow[] = [];

      jsonData.forEach((row, index) => {
        const rowNum = index + 2; // Excel row (header is 1)
        
        // Validación de campos requeridos
        if (!row.fecha) {
          validationErrors.push({ row: rowNum, field: "fecha", message: "Fecha es requerida" });
        }
        
        if (!row.cliente) {
          validationErrors.push({ row: rowNum, field: "cliente", message: "Cliente es requerido" });
        }
        
        if (!row.items) {
          validationErrors.push({ row: rowNum, field: "items", message: "Items son requeridos" });
        }
        
        if (!row.total || isNaN(Number(row.total))) {
          validationErrors.push({ row: rowNum, field: "total", message: "Total debe ser un número válido" });
        }
        
        if (!row.metodoPago) {
          validationErrors.push({ row: rowNum, field: "metodoPago", message: "Método de pago es requerido" });
        }

        // Validación de formato de fecha
        if (row.fecha) {
          const dateStr = String(row.fecha);
          const parsedDate = new Date(dateStr);
          if (isNaN(parsedDate.getTime())) {
            validationErrors.push({ row: rowNum, field: "fecha", message: "Formato de fecha inválido (use YYYY-MM-DD)" });
          }
        }

        // Validación de items (debe ser JSON válido)
        if (row.items) {
          try {
            const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
            if (!Array.isArray(items) || items.length === 0) {
              validationErrors.push({ row: rowNum, field: "items", message: "Items debe ser un array no vacío" });
            } else {
              items.forEach((item: any, itemIndex: number) => {
                if (!item.name) {
                  validationErrors.push({ row: rowNum, field: `items[${itemIndex}].name`, message: "Nombre del item es requerido" });
                }
                if (!item.quantity || isNaN(Number(item.quantity))) {
                  validationErrors.push({ row: rowNum, field: `items[${itemIndex}].quantity`, message: "Cantidad debe ser un número" });
                }
                if (!item.price || isNaN(Number(item.price))) {
                  validationErrors.push({ row: rowNum, field: `items[${itemIndex}].price`, message: "Precio debe ser un número" });
                }
              });
            }
          } catch (error) {
            validationErrors.push({ row: rowNum, field: "items", message: "Items debe ser un JSON válido" });
          }
        }

        // Validación de método de pago
        const validPaymentMethods = ["efectivo", "tarjeta", "credito", "yape", "plin", "transferencia"];
        if (row.metodoPago && !validPaymentMethods.includes(String(row.metodoPago).toLowerCase())) {
          validationErrors.push({ 
            row: rowNum, 
            field: "metodoPago", 
            message: `Método de pago inválido. Use: ${validPaymentMethods.join(", ")}` 
          });
        }

        if (validationErrors.filter(e => e.row === rowNum).length === 0) {
          validRows.push({
            fecha: String(row.fecha),
            cliente: String(row.cliente),
            items: String(row.items),
            total: Number(row.total),
            metodoPago: String(row.metodoPago).toLowerCase(),
            tipo: row.tipo ? String(row.tipo) : "normal",
            vendedor: row.vendedor ? String(row.vendedor) : user?.id || "Sistema"
          });
        }
      });

      setErrors(validationErrors);
      setPreview(validRows);
    } catch (error) {
      console.error("Error processing file:", error);
      setErrors([{ row: 0, field: "file", message: "Error al procesar el archivo Excel" }]);
    }
  };

  const importSales = async () => {
    if (!user) return;
    if (preview.length === 0) {
      setErrors([{ row: 0, field: "general", message: "No hay datos válidos para importar" }]);
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      // Cargar clientes para buscar por nombre
      const clientsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
      const clientsMap = new Map<string, any>();
      
      if (clientsData) {
        Object.entries(clientsData).forEach(([id, client]) => {
          const fullName = client?.fullName || client?.names || client?.name || "";
          if (fullName) {
            clientsMap.set(fullName.toLowerCase(), { id, ...client });
          }
        });
      }

      for (const row of preview) {
        try {
          // Obtener correlativo
          const correlative = await RTDBHelper.getNextCorrelative("sale");

          // Parsear items
          const items = JSON.parse(row.items);

          // Buscar cliente
          let clientData = null;
          const clientMatch = clientsMap.get(row.cliente.toLowerCase());
          
          // Si es venta a crédito, el cliente debe existir
          if (row.metodoPago === "credito") {
            if (!clientMatch) {
              failedCount++;
              console.error(`Cliente no encontrado para venta a crédito: ${row.cliente}`);
              continue;
            }
            clientData = { id: clientMatch.id, name: clientMatch.fullName || clientMatch.name };
          } else {
            clientData = clientMatch 
              ? { id: clientMatch.id, name: clientMatch.fullName || clientMatch.name }
              : null;
          }

          // Crear objeto de venta
          const saleDate = new Date(row.fecha).toISOString();
          const saleBase = {
            correlative,
            date: saleDate,
            cashier: row.vendedor || user.id,
            client: clientData,
            items: items,
            subtotal: row.total,
            tax: 0,
            total: row.total,
            paymentMethod: row.metodoPago,
            type: row.tipo || "normal",
            status: "completed",
            paid: row.metodoPago !== "credito" ? row.total : 0,
            createdBy: user.id,
            createdAt: saleDate,
            origin: "IMPORT",
            imported: true,
            importedAt: new Date().toISOString()
          };

          // Guardar venta
          const saleId = await RTDBHelper.pushData(RTDB_PATHS.sales, saleBase);

          // Si es crédito, crear entrada en cuentas por cobrar
          if (row.metodoPago === "credito" && clientData) {
            const arEntry = {
              saleId,
              correlative,
              clientId: clientData.id,
              clientName: clientData.name || "Cliente",
              amount: row.total,
              date: saleDate,
              status: "pending",
              type: "sale",
              origin: "IMPORT",
              items: items,
              createdAt: saleDate,
            };
            
            const arEntryPath = `${RTDB_PATHS.accounts_receivable}/${clientData.id}/entries/${saleId}`;
            await RTDBHelper.setData(arEntryPath, arEntry);
          }

          // Log de auditoría
          await RTDBHelper.logAction(
            user.id,
            "sale_imported",
            {
              saleId,
              correlative,
              total: row.total,
              paymentMethod: row.metodoPago,
              itemCount: items.length,
              cliente: row.cliente
            },
            "sale",
            saleId
          );

          successCount++;
        } catch (error) {
          console.error(`Error importing sale for client ${row.cliente}:`, error);
          failedCount++;
        }
      }

      setStats({ total: preview.length, success: successCount, failed: failedCount });

      if (successCount > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error importing sales:", error);
      setErrors([{ row: 0, field: "general", message: "Error al importar ventas" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setErrors([]);
    setPreview([]);
    setStats({ total: 0, success: 0, failed: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Ventas desde Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instrucciones */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Instrucciones:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Descargue la plantilla Excel para ver el formato correcto</li>
                <li>Complete los datos: fecha (YYYY-MM-DD), cliente, items (JSON), total, metodoPago</li>
                <li>Métodos de pago válidos: efectivo, tarjeta, credito, yape, plin, transferencia</li>
                <li>Para ventas a crédito, el cliente debe existir en el sistema</li>
                <li>Items debe ser un array JSON: [{"{"}"name":"Producto","quantity":1,"price":10.50{"}"}]</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Botón descargar plantilla */}
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Descargar Plantilla Excel
          </Button>

          <Separator />

          {/* Input de archivo */}
          <div>
            <Label htmlFor="file-upload">Seleccionar archivo Excel</Label>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="mt-2"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                {file.name}
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Errores de validación */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Errores encontrados ({errors.length}):</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm max-h-40 overflow-y-auto">
                  {errors.map((error, idx) => (
                    <li key={idx}>
                      Fila {error.row} - {error.field}: {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview de datos válidos */}
          {preview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Vista Previa ({preview.length} ventas válidas)
                </CardTitle>
                <CardDescription>
                  Estas ventas serán importadas al sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {preview.slice(0, 10).map((row, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-muted/50">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <strong>Cliente:</strong> {row.cliente}
                        </div>
                        <div>
                          <strong>Fecha:</strong> {row.fecha}
                        </div>
                        <div>
                          <strong>Total:</strong> S/ {row.total.toFixed(2)}
                        </div>
                        <div>
                          <strong>Método:</strong> 
                          <Badge variant={row.metodoPago === "credito" ? "destructive" : "outline"} className="ml-2">
                            {row.metodoPago}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {preview.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ... y {preview.length - 10} ventas más
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estadísticas de importación */}
          {stats.total > 0 && (
            <Alert variant={stats.failed === 0 ? "default" : "destructive"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Resultado de importación:</strong>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>Total: {stats.total}</div>
                  <div className="text-success">Exitosas: {stats.success}</div>
                  <div className="text-destructive">Fallidas: {stats.failed}</div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={importSales}
              disabled={preview.length === 0 || isProcessing || errors.length > 0}
              className="bg-primary"
            >
              {isProcessing ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {preview.length} Ventas
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

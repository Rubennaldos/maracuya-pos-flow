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
  codigoCliente: string;
  cliente: string;
  producto: string;
  cantidad: number;
  precio: number;
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
        codigoCliente: "C040989",
        cliente: "Miss Joselyn",
        producto: "Chisito",
        cantidad: 2,
        precio: 3.00,
        metodoPago: "efectivo",
        tipo: "normal",
        vendedor: "Sistema"
      },
      {
        fecha: "2024-01-15",
        codigoCliente: "C040990",
        cliente: "María González",
        producto: "Galleta",
        cantidad: 1,
        precio: 2.50,
        metodoPago: "credito",
        tipo: "normal",
        vendedor: "Sistema"
      },
      {
        fecha: "2024-01-15",
        codigoCliente: "C040990",
        cliente: "María González",
        producto: "Jugo",
        cantidad: 3,
        precio: 4.00,
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
      { wch: 15 }, // codigoCliente
      { wch: 25 }, // cliente
      { wch: 30 }, // producto
      { wch: 10 }, // cantidad
      { wch: 10 }, // precio
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
        
        if (!row.codigoCliente) {
          validationErrors.push({ row: rowNum, field: "codigoCliente", message: "Código de cliente es requerido" });
        }
        
        if (!row.cliente) {
          validationErrors.push({ row: rowNum, field: "cliente", message: "Nombre de cliente es requerido" });
        }
        
        if (!row.producto) {
          validationErrors.push({ row: rowNum, field: "producto", message: "Producto es requerido" });
        }
        
        if (!row.cantidad || isNaN(Number(row.cantidad))) {
          validationErrors.push({ row: rowNum, field: "cantidad", message: "Cantidad debe ser un número válido" });
        }
        
        if (!row.precio || isNaN(Number(row.precio))) {
          validationErrors.push({ row: rowNum, field: "precio", message: "Precio debe ser un número válido" });
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
            codigoCliente: String(row.codigoCliente),
            cliente: String(row.cliente),
            producto: String(row.producto),
            cantidad: Number(row.cantidad),
            precio: Number(row.precio),
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
      // Cargar clientes para buscar por código único
      const clientsData = await RTDBHelper.getData<Record<string, any>>(RTDB_PATHS.clients);
      const clientsByCode = new Map<string, any>();
      
      if (clientsData) {
        Object.entries(clientsData).forEach(([id, client]) => {
          const code = client?.code || client?.id || "";
          if (code) {
            clientsByCode.set(String(code).toUpperCase(), { id, ...client });
          }
        });
      }

      // Agrupar filas por fecha + codigoCliente + metodoPago para crear ventas consolidadas
      const salesGroups = new Map<string, ImportRow[]>();
      
      preview.forEach(row => {
        const key = `${row.fecha}|${row.codigoCliente}|${row.metodoPago}`;
        if (!salesGroups.has(key)) {
          salesGroups.set(key, []);
        }
        salesGroups.get(key)!.push(row);
      });

      for (const [key, rows] of salesGroups) {
        try {
          const firstRow = rows[0];
          
          // Obtener correlativo
          const correlative = await RTDBHelper.getNextCorrelative("sale");

          // Crear items array - usar productos tal cual sin buscar en sistema
          const items = rows.map(row => ({
            name: row.producto,
            quantity: row.cantidad,
            price: row.precio,
            id: `imported-${Date.now()}-${Math.random()}` // ID temporal para items importados
          }));

          // Calcular total
          const total = rows.reduce((sum, row) => sum + (row.cantidad * row.precio), 0);

          // Buscar cliente por código
          let clientData = null;
          const clientMatch = clientsByCode.get(firstRow.codigoCliente.toUpperCase());
          
          // Si es venta a crédito, el cliente debe existir
          if (firstRow.metodoPago === "credito") {
            if (!clientMatch) {
              failedCount++;
              console.error(`Cliente no encontrado para venta a crédito: ${firstRow.codigoCliente} - ${firstRow.cliente}`);
              continue;
            }
            clientData = { id: clientMatch.id, name: clientMatch.fullName || clientMatch.name || firstRow.cliente };
          } else {
            clientData = clientMatch 
              ? { id: clientMatch.id, name: clientMatch.fullName || clientMatch.name || firstRow.cliente }
              : { id: null, name: firstRow.cliente }; // Para ventas no crédito, guardar el nombre aunque no exista
          }

          // Crear objeto de venta
          const saleDate = new Date(firstRow.fecha).toISOString();
          const saleBase = {
            correlative,
            date: saleDate,
            cashier: firstRow.vendedor || user.id,
            client: clientData,
            items: items,
            subtotal: total,
            tax: 0,
            total: total,
            paymentMethod: firstRow.metodoPago,
            type: firstRow.tipo || "normal",
            status: "completed",
            paid: firstRow.metodoPago !== "credito" ? total : 0,
            createdBy: user.id,
            createdAt: saleDate,
            origin: "IMPORT",
            imported: true,
            importedAt: new Date().toISOString()
          };

          // Guardar venta
          const saleId = await RTDBHelper.pushData(RTDB_PATHS.sales, saleBase);

          // Si es crédito, crear entrada en cuentas por cobrar
          if (firstRow.metodoPago === "credito" && clientData) {
            const arEntry = {
              saleId,
              correlative,
              clientId: clientData.id,
              clientName: clientData.name || "Cliente",
              amount: total,
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
              total: total,
              paymentMethod: firstRow.metodoPago,
              itemCount: items.length,
              cliente: firstRow.cliente
            },
            "sale",
            saleId
          );

          successCount++;
        } catch (error) {
          console.error(`Error importing sale:`, error);
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
                <li>Complete una fila por cada producto: fecha (YYYY-MM-DD), codigoCliente, cliente, producto, cantidad, precio, metodoPago</li>
                <li><strong>Importante:</strong> El código de cliente debe coincidir con el código en el sistema (ej: C040989)</li>
                <li>Métodos de pago válidos: efectivo, tarjeta, credito, yape, plin, transferencia</li>
                <li>Para ventas a crédito, el cliente DEBE existir en el sistema con su código correcto</li>
                <li>Los productos se agruparán automáticamente por fecha, código cliente y método de pago</li>
                <li>Los productos no necesitan estar creados previamente - se guardarán solo para detalle de venta</li>
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
                          <strong>Cliente:</strong> {row.cliente} ({row.codigoCliente})
                        </div>
                        <div>
                          <strong>Fecha:</strong> {row.fecha}
                        </div>
                        <div className="col-span-2">
                          <strong>Producto:</strong> {row.producto} x{row.cantidad} @ S/ {row.precio.toFixed(2)}
                        </div>
                        <div>
                          <strong>Subtotal:</strong> S/ {(row.cantidad * row.precio).toFixed(2)}
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

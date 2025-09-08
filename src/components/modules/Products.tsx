import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Search, Plus, Edit, Trash2, Upload, Download,
  Package, DollarSign, Utensils, Eye, EyeOff, Image, FileSpreadsheet
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  costPrice: number;
  salePrice: number;
  image: string;
  isKitchen: boolean;
  isActive: boolean;
  description: string;
  hasStock: boolean;
  stock: number;
}

interface ProductsProps {
  onBack: () => void;
}

export const Products = ({ onBack }: ProductsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    code: "",
    category: "",
    costPrice: 0,
    salePrice: 0,
    image: "",
    isKitchen: false,
    isActive: true,
    description: "",
    hasStock: false,
    stock: 0
  });

  const { uploadImage, isUploading } = useImageUpload();

  // Load products from RTDB
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsData = await RTDBHelper.getData<Record<string, Product>>(RTDB_PATHS.products);
      if (productsData) {
        const productsArray = Object.values(productsData);
        setProducts(productsArray);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateProductCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PROD${timestamp}`;
  };

  const saveProduct = async () => {
    try {
      if (editingProduct) {
        // Update existing product in RTDB
        const updatedProduct = { ...newProduct, id: editingProduct.id } as Product;
        await RTDBHelper.setData(`${RTDB_PATHS.products}/${editingProduct.id}`, updatedProduct);
        
        // Update local state
        const updatedProducts = products.map(p => 
          p.id === editingProduct.id ? updatedProduct : p
        );
        setProducts(updatedProducts);
      } else {
        // Create new product
        const productId = generateProductCode();
        const productToSave: Product = {
          ...newProduct,
          id: productId,
          code: newProduct.code || productId
        } as Product;
        
        // Save to RTDB
        await RTDBHelper.setData(`${RTDB_PATHS.products}/${productId}`, productToSave);
        
        // Update local state
        setProducts([...products, productToSave]);
      }
      
      // Reset form and close dialog
      setNewProduct({
        name: "",
        code: "",
        category: "",
        costPrice: 0,
        salePrice: 0,
        image: "",
        isKitchen: false,
        isActive: true,
        description: "",
        hasStock: false,
        stock: 0
      });
      setEditingProduct(null);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const toggleProductStatus = async (productId: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (product) {
        const updatedProduct = { ...product, isActive: !product.isActive };
        await RTDBHelper.setData(`${RTDB_PATHS.products}/${productId}`, updatedProduct);
        
        setProducts(products.map(p => 
          p.id === productId ? updatedProduct : p
        ));
      }
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct(product);
    setIsCreateDialogOpen(true);
  };

  const canDeleteProduct = (productId: string) => {
    // Here you could check if the product is used in any sales
    return true;
  };

  const deleteProduct = async (productId: string) => {
    try {
      await RTDBHelper.removeData(`${RTDB_PATHS.products}/${productId}`);
      setProducts(products.filter(product => product.id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const imageDataUrl = await uploadImage(file);
        setNewProduct({ ...newProduct, image: imageDataUrl });
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error al subir la imagen. Intenta de nuevo.');
      }
    }
  };

  // Excel import/export functions
  const downloadTemplate = () => {
    const templateData = [
      {
        name: 'Producto Ejemplo',
        code: 'PROD001',
        category: 'Categoría',
        costPrice: 10.00,
        salePrice: 15.00,
        description: 'Descripción del producto',
        isKitchen: 'SI',
        isActive: 'SI',
        hasStock: 'SI',
        stock: 100
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Add headers and formatting
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "CCCCCC" } }
        };
      }
    }

    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const importedProducts: Product[] = [];
      
      for (const row of jsonData) {
        const productId = generateProductCode();
        const product: Product = {
          id: productId,
          name: row.name || '',
          code: row.code || productId,
          category: row.category || 'General',
          costPrice: parseFloat(row.costPrice) || 0,
          salePrice: parseFloat(row.salePrice) || 0,
          image: '',
          description: row.description || '',
          isKitchen: row.isKitchen === 'SI' || row.isKitchen === true,
          isActive: row.isActive === 'SI' || row.isActive === true,
          hasStock: row.hasStock === 'SI' || row.hasStock === true,
          stock: parseInt(row.stock) || 0
        };

        // Save to RTDB
        await RTDBHelper.setData(`${RTDB_PATHS.products}/${productId}`, product);
        importedProducts.push(product);
      }

      // Update local state
      setProducts([...products, ...importedProducts]);
      alert(`Se importaron ${importedProducts.length} productos exitosamente.`);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error importing products:', error);
      alert('Error al importar productos. Verifica el formato del archivo.');
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
            <Package className="h-6 w-6" />
            Gestión de Productos
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar Plantilla
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileImport}
              style={{ display: 'none' }}
              id="file-import"
            />
            <Button 
              variant="outline"
              onClick={() => document.getElementById('file-import')?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Importar Excel
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Create/Edit Product Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              
              <div>
                <Label htmlFor="name">Nombre del Producto</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Ej: Ensalada César"
                />
              </div>

              <div>
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={newProduct.code}
                  onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                  placeholder="Ej: ENS001"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  placeholder="Ej: Ensaladas"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="costPrice">Precio Costo (S/)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="salePrice">Precio Venta (S/)</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    value={newProduct.salePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, salePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Descripción del producto"
                />
              </div>

              <div>
                <Label htmlFor="image">Imagen del Producto</Label>
                <div className="mt-2">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90"
                  />
                  {isUploading && <p className="text-sm text-muted-foreground mt-2">Subiendo imagen...</p>}
                  {newProduct.image && (
                    <div className="mt-2">
                      <img 
                        src={newProduct.image} 
                        alt="Preview" 
                        className="w-20 h-20 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isKitchen" className="flex items-center gap-2">
                    <Utensils className="h-4 w-4" />
                    Requiere Cocina
                  </Label>
                  <Switch
                    id="isKitchen"
                    checked={newProduct.isKitchen}
                    onCheckedChange={(checked) => setNewProduct({ ...newProduct, isKitchen: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="hasStock" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Control de Stock
                  </Label>
                  <Switch
                    id="hasStock"
                    checked={newProduct.hasStock}
                    onCheckedChange={(checked) => setNewProduct({ ...newProduct, hasStock: checked })}
                  />
                </div>

                {newProduct.hasStock && (
                  <div>
                    <Label htmlFor="stock">Stock Inicial</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Producto Activo
                  </Label>
                  <Switch
                    id="isActive"
                    checked={newProduct.isActive}
                    onCheckedChange={(checked) => setNewProduct({ ...newProduct, isActive: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={saveProduct}>
                  {editingProduct ? 'Actualizar' : 'Crear'} Producto
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos por nombre, código o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="aspect-square overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Image className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm">{product.name}</CardTitle>
                    <div className="flex gap-1">
                      {product.isKitchen && (
                        <Badge variant="secondary" className="text-xs">
                          <Utensils className="h-3 w-3 mr-1" />
                          Cocina
                        </Badge>
                      )}
                      <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs">
                        {product.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{product.code}</p>
                </CardHeader>
                
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo:</span>
                      <span>S/ {product.costPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Venta:</span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        S/ {product.salePrice.toFixed(2)}
                      </span>
                    </div>
                    
                    {product.hasStock && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stock:</span>
                        <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                          {product.stock}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleProductStatus(product.id)}
                        className="flex-1"
                      >
                        {product.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(product)}
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canDeleteProduct(product.id)}
                            className="flex-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El producto "{product.name}" será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteProduct(product.id)}>
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
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza creando tu primer producto o importa desde Excel'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

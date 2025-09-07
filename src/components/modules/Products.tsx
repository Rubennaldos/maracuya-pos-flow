import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Search, Plus, Edit, Trash2, Upload, 
  Package, DollarSign, Utensils, Eye, EyeOff
} from "lucide-react";
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

// Mock products data
const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Ensalada César',
    code: 'ENS001',
    category: 'Ensaladas',
    costPrice: 8.00,
    salePrice: 12.50,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=300&fit=crop',
    isKitchen: true,
    isActive: true,
    description: 'Ensalada fresca con lechuga, crutones y aderezo césar',
    hasStock: true,
    stock: 25
  },
  {
    id: '2',
    name: 'Sandwich Integral',
    code: 'SAN001',
    category: 'Sandwiches',
    costPrice: 5.00,
    salePrice: 8.50,
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433a?w=300&h=300&fit=crop',
    isKitchen: true,
    isActive: true,
    description: 'Sandwich en pan integral con vegetales frescos',
    hasStock: true,
    stock: 15
  },
  {
    id: '3',
    name: 'Jugo Natural',
    code: 'BEB001',
    category: 'Bebidas',
    costPrice: 2.50,
    salePrice: 6.00,
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300&h=300&fit=crop',
    isKitchen: false,
    isActive: true,
    description: 'Jugo natural de frutas de temporada',
    hasStock: false,
    stock: 0
  }
];

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
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    code: '',
    category: '',
    costPrice: 0,
    salePrice: 0,
    image: '',
    isKitchen: false,
    isActive: true,
    description: '',
    hasStock: false,
    stock: 0
  });

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateProductCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PRD${timestamp}`;
  };

  const saveProduct = () => {
    if (editingProduct) {
      // Edit existing product
      setProducts(prev => prev.map(p => 
        p.id === editingProduct.id 
          ? { ...newProduct as Product, id: editingProduct.id }
          : p
      ));
      setEditingProduct(null);
    } else {
      // Create new product
      const product: Product = {
        ...newProduct as Product,
        id: Date.now().toString(),
        code: newProduct.code || generateProductCode()
      };
      setProducts(prev => [...prev, product]);
    }
    
    setNewProduct({
      name: '',
      code: '',
      category: '',
      costPrice: 0,
      salePrice: 0,
      image: '',
      isKitchen: false,
      isActive: true,
      description: '',
      hasStock: false,
      stock: 0
    });
    setIsCreateDialogOpen(false);
  };

  const toggleProductStatus = (productId: string) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct(product);
    setIsCreateDialogOpen(true);
  };

  const canDeleteProduct = (productId: string) => {
    // In production, check if product has sales
    return true;
  };

  const deleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
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
            <h1 className="text-2xl font-bold text-foreground">Gestión de Productos</h1>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingProduct(null);
                setNewProduct({
                  name: '',
                  code: '',
                  category: '',
                  costPrice: 0,
                  salePrice: 0,
                  image: '',
                  isKitchen: false,
                  isActive: true,
                  description: '',
                  hasStock: false,
                  stock: 0
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Ensalada César"
                  />
                </div>

                <div>
                  <Label htmlFor="code">Código (opcional)</Label>
                  <Input
                    id="code"
                    value={newProduct.code}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="Ej: ENS001 (auto-generado si está vacío)"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ej: Ensaladas"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="costPrice">Precio de Costo</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      value={newProduct.costPrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="salePrice">Precio de Venta</Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      value={newProduct.salePrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción del producto..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="image">URL de Imagen</Label>
                  <Input
                    id="image"
                    value={newProduct.image}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isKitchen"
                      checked={newProduct.isKitchen}
                      onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, isKitchen: checked }))}
                    />
                    <Label htmlFor="isKitchen">Producto de Cocina</Label>
                  </div>
                  <Badge className="bg-pos-kitchen text-foreground">
                    <Utensils className="w-3 h-3 mr-1" />
                    Cocina
                  </Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasStock"
                    checked={newProduct.hasStock}
                    onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, hasStock: checked }))}
                  />
                  <Label htmlFor="hasStock">Controlar Stock</Label>
                </div>

                {newProduct.hasStock && (
                  <div>
                    <Label htmlFor="stock">Stock Inicial</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newProduct.isActive}
                    onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Producto Activo</Label>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button onClick={saveProduct} className="flex-1">
                    {editingProduct ? 'Actualizar' : 'Crear'} Producto
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
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className={`transition-all duration-200 ${!product.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-0">
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="absolute top-2 right-2 flex flex-col space-y-1">
                    {product.isKitchen && (
                      <Badge className="bg-pos-kitchen text-foreground">
                        <Utensils className="w-3 h-3 mr-1" />
                        Cocina
                      </Badge>
                    )}
                    {!product.isActive && (
                      <Badge variant="secondary">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Inactivo
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleProductStatus(product.id)}
                    >
                      {product.isActive ? (
                        <Eye className="w-4 h-4 text-success" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mb-1">
                    Código: {product.code}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {product.category}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Costo:</span>
                      <span>S/ {product.costPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Venta:</span>
                      <span className="text-primary">S/ {product.salePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-success">
                      <span>Margen:</span>
                      <span>S/ {(product.salePrice - product.costPrice).toFixed(2)}</span>
                    </div>
                  </div>

                  {product.hasStock && (
                    <div className="flex justify-between text-sm mb-4">
                      <span>Stock:</span>
                      <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                        {product.stock} unidades
                      </Badge>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(product)}
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
                          disabled={!canDeleteProduct(product.id)}
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-3 h-3" />
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
                          <AlertDialogAction
                            onClick={() => deleteProduct(product.id)}
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
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron productos</h3>
            <p className="text-muted-foreground">Intenta con otros términos de búsqueda</p>
          </div>
        )}
      </div>
    </div>
  );
};
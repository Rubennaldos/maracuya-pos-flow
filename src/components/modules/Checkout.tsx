import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Calculator, DollarSign, CreditCard, 
  Banknote, Smartphone, FileText, TrendingUp
} from "lucide-react";

interface CheckoutProps {
  onBack: () => void;
}

// Mock data for daily sales
const DAILY_SALES = {
  date: '2024-01-15',
  sales: {
    efectivo: 450.00,
    credito: 280.00,
    transferencia: 150.00,
    yape: 120.00,
    plin: 80.00
  },
  totalSales: 1080.00,
  totalCash: 450.00,
  initialCash: 100.00,
  expenses: 50.00,
  expectedCash: 500.00
};

export const Checkout = ({ onBack }: CheckoutProps) => {
  const [currentCash, setCurrentCash] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(DAILY_SALES.expenses);
  const [initialCash, setInitialCash] = useState<number>(DAILY_SALES.initialCash);
  const [difference, setDifference] = useState<number>(0);

  useEffect(() => {
    const expected = DAILY_SALES.initialCash + DAILY_SALES.totalCash - expenses;
    setDifference(currentCash - expected);
  }, [currentCash, expenses]);

  const paymentMethods = [
    {
      id: 'efectivo',
      name: 'Efectivo',
      amount: DAILY_SALES.sales.efectivo,
      icon: Banknote,
      color: 'text-success'
    },
    {
      id: 'credito',
      name: 'Crédito',
      amount: DAILY_SALES.sales.credito,
      icon: CreditCard,
      color: 'text-warning'
    },
    {
      id: 'transferencia',
      name: 'Transferencia',
      amount: DAILY_SALES.sales.transferencia,
      icon: FileText,
      color: 'text-primary'
    },
    {
      id: 'yape',
      name: 'Yape',
      amount: DAILY_SALES.sales.yape,
      icon: Smartphone,
      color: 'text-secondary'
    },
    {
      id: 'plin',
      name: 'Plin',
      amount: DAILY_SALES.sales.plin,
      icon: Smartphone,
      color: 'text-accent'
    }
  ];

  const expectedCash = initialCash + DAILY_SALES.totalCash - expenses;

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
            <h1 className="text-2xl font-bold text-foreground">Cierre de Caja</h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Fecha</p>
            <p className="font-semibold">{DAILY_SALES.date}</p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                S/ {DAILY_SALES.totalSales.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo en Ventas</CardTitle>
              <Banknote className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                S/ {DAILY_SALES.totalCash.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo Esperado</CardTitle>
              <Calculator className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                S/ {expectedCash.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inicial + Ventas - Gastos
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Methods Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethods.map((method) => {
                const IconComponent = method.icon;
                return (
                  <div key={method.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`w-5 h-5 ${method.color}`} />
                      <span className="font-medium">{method.name}</span>
                    </div>
                    <span className="font-bold">S/ {method.amount.toFixed(2)}</span>
                  </div>
                );
              })}
              
              <Separator />
              
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Ventas</span>
                <span className="text-primary">S/ {DAILY_SALES.totalSales.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Cash Count */}
          <Card>
            <CardHeader>
              <CardTitle>Conteo de Caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="initialCash">Caja Inicial</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="initialCash"
                      type="number"
                      step="0.01"
                      value={initialCash}
                      onChange={(e) => setInitialCash(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expenses">Gastos del Día</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="expenses"
                      type="number"
                      step="0.01"
                      value={expenses}
                      onChange={(e) => setExpenses(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="currentCash">Efectivo Actual en Caja</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="currentCash"
                      type="number"
                      step="0.01"
                      value={currentCash}
                      onChange={(e) => setCurrentCash(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Caja Inicial:</span>
                  <span>S/ {initialCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Ventas en Efectivo:</span>
                  <span className="text-success">S/ {DAILY_SALES.totalCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>- Gastos:</span>
                  <span className="text-destructive">S/ {expenses.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-semibold">
                  <span>Efectivo Esperado:</span>
                  <span>S/ {expectedCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Efectivo Actual:</span>
                  <span>S/ {currentCash.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className={`flex justify-between text-xl font-bold ${
                  difference === 0 ? 'text-success' : 
                  difference > 0 ? 'text-primary' : 'text-destructive'
                }`}>
                  <span>Diferencia:</span>
                  <span>
                    {difference >= 0 ? '+' : ''}S/ {difference.toFixed(2)}
                  </span>
                </div>

                {difference !== 0 && (
                  <div className={`text-sm p-3 rounded-lg ${
                    difference > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {difference > 0 ? 
                      `Hay S/ ${difference.toFixed(2)} de más en caja` : 
                      `Faltan S/ ${Math.abs(difference).toFixed(2)} en caja`
                    }
                  </div>
                )}
              </div>

              <Button className="w-full mt-6" size="lg">
                <Calculator className="w-4 h-4 mr-2" />
                Cerrar Caja
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
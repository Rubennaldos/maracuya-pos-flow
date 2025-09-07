import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export const LoginForm = () => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    
    setIsLoading(true);
    const success = await login(pin);
    
    if (success) {
      toast({
        title: "Bienvenido",
        description: "Inicio de sesión exitoso",
      });
    } else {
      toast({
        title: "Error",
        description: "PIN incorrecto",
        variant: "destructive",
      });
      setPin("");
    }
    setIsLoading(false);
  };

  const handlePinInput = (value: string) => {
    if (value.length <= 6) {
      setPin(value);
    }
  };

  const numberPad = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['⌫', '0', '✓']
  ];

  const handleNumberPad = (value: string) => {
    if (value === '⌫') {
      setPin(prev => prev.slice(0, -1));
    } else if (value === '✓') {
      handleLogin(new Event('submit') as any);
    } else {
      handlePinInput(pin + value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-pos-product to-accent flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-strong">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl text-primary">
            Sistema de Ventas
          </CardTitle>
          <p className="text-muted-foreground">
            Tiendas y Concesionarias Saludables
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                PIN de Acceso
              </label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  placeholder="Ingrese su PIN"
                  className="text-center text-lg tracking-widest pr-10"
                  maxLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary"
              disabled={isLoading || pin.length < 4}
            >
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          {/* Touch-friendly number pad */}
          <div className="grid grid-cols-3 gap-2 mt-6">
            {numberPad.flat().map((num, index) => (
              <Button
                key={index}
                variant="outline"
                size="lg"
                className="h-14 text-lg font-semibold"
                onClick={() => handleNumberPad(num)}
                disabled={isLoading}
              >
                {num}
              </Button>
            ))}
          </div>

          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>Demo PINs:</p>
            <p>Admin: 1234 | Cajero: 5678 | Cobranzas: 9999</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
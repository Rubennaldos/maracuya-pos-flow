import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { useSession } from "@/state/session";
import { RTDBHelper } from "@/lib/rt";
import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const RTDBLogin = () => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useSession();

  // Initialize RTDB data on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        await RTDBHelper.initializeConfig();
        await RTDBHelper.initializeDemoUsers();
      } catch (error) {
        console.error('Error initializing RTDB:', error);
        setError('Error de conexión con la base de datos');
      }
    };

    initializeData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const success = await login(pin);
      if (!success) {
        setError("PIN incorrecto. Intenta nuevamente.");
        setPin("");
      }
    } catch (error) {
      setError("Error de conexión. Verifica tu conexión a internet.");
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Solo números
    if (value.length <= 6) { // Máximo 6 dígitos
      setPin(value);
      setError("");
    }
  };

  const handleKeypadClick = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError("");
    }
  };

  const handleClearPin = () => {
    setPin("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant border-2 border-primary/20">
          <CardHeader className="text-center pb-4">
            <Logo size="lg" />
            <CardTitle className="text-2xl font-bold text-foreground">
              Maracuyá Villa Gratia
            </CardTitle>
            <p className="text-muted-foreground">
              Sistema de Punto de Venta
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de Acceso</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="Ingresa tu PIN"
                    className="text-center text-xl tracking-widest pr-10"
                    autoFocus
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg bg-gradient-to-r from-primary to-primary-light"
                disabled={!pin.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Ingresar
                  </>
                )}
              </Button>
            </form>

            {/* Teclado numérico para pantallas táctiles */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Button
                  key={digit}
                  type="button"
                  variant="outline"
                  className="h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => handleKeypadClick(digit.toString())}
                  disabled={isLoading}
                >
                  {digit}
                </Button>
              ))}
              
              <Button
                type="button"
                variant="outline"
                className="h-12 text-lg font-semibold hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={handleClearPin}
                disabled={isLoading}
              >
                Borrar
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleKeypadClick("0")}
                disabled={isLoading}
              >
                0
              </Button>
              
              <Button
                type="submit"
                variant="default"
                className="h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground"
                disabled={!pin.trim() || isLoading}
                onClick={handleSubmit}
              >
                ✓
              </Button>
            </div>

            {/* Información de usuario demo */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">PINs de Demo:</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>• Admin: <code className="bg-muted px-1 rounded">1234</code></div>
                <div>• Cajero: <code className="bg-muted px-1 rounded">5678</code></div>
                <div>• Cobranzas: <code className="bg-muted px-1 rounded">9999</code></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
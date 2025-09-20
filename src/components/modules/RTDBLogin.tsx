// src/components/modules/RTDBLogin.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { useSession } from "@/state/session";
import { RTDBHelper } from "@/lib/rt";
import { Eye, EyeOff, Lock, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/* ===== Seguridad local ===== */
const MAX_ATTEMPTS = 5;
const BASE_LOCK_MINUTES = 10;
const COOLDOWN_MS = 3000;
const SESSION_HOURS = 8;

const LS = {
  ATTEMPTS: "admin_attempts",
  LOCK_UNTIL: "admin_lock_until",
  AUTH: "admin_auth",
  AUTH_EXP: "admin_exp",
  LAST_TRY: "admin_last_try",
} as const;

const now = () => Date.now();
const minutes = (ms: number) => Math.floor(ms / 60000);
const seconds = (ms: number) => Math.ceil((ms % 60000) / 1000);

const getAttempts = () => parseInt(localStorage.getItem(LS.ATTEMPTS) || "0", 10) || 0;
const setAttempts = (n: number) => localStorage.setItem(LS.ATTEMPTS, String(n));
const resetAttempts = () => localStorage.removeItem(LS.ATTEMPTS);

const getLockUntil = () => parseInt(localStorage.getItem(LS.LOCK_UNTIL) || "0", 10) || 0;
const setLockUntil = (ts: number) => localStorage.setItem(LS.LOCK_UNTIL, String(ts));
const clearLock = () => localStorage.removeItem(LS.LOCK_UNTIL);

const markAdminSession = (hours = SESSION_HOURS) => {
  const exp = now() + hours * 60 * 60 * 1000;
  localStorage.setItem(LS.AUTH, "1");
  localStorage.setItem(LS.AUTH_EXP, String(exp));
};

export const isAdminSessionValid = () => {
  const auth = localStorage.getItem(LS.AUTH) === "1";
  const exp = parseInt(localStorage.getItem(LS.AUTH_EXP) || "0", 10);
  return auth && exp > now();
};

export const clearAdminSession = () => {
  localStorage.removeItem(LS.AUTH);
  localStorage.removeItem(LS.AUTH_EXP);
};

function RTDBLogin() {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [lockUntil, setLockUntilState] = useState<number>(getLockUntil());
  const [attempts, setAttemptsState] = useState<number>(getAttempts());
  const { login } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);

  // Inicializar datos base en RTDB
  useEffect(() => {
    const boot = async () => {
      try {
        await RTDBHelper.initializeConfig();
        await RTDBHelper.initializeDemoUsers();
      } catch (err) {
        console.error("Error initializing RTDB:", err);
        setError("Error de conexión con la base de datos");
      }
    };
    boot();
  }, []);

  // Mantener contador de bloqueo “vivo”
  useEffect(() => {
    if (lockUntil <= now()) return;
    const t = setInterval(() => {
      const current = getLockUntil();
      if (current <= now()) {
        clearInterval(t);
        clearLock();
        setLockUntilState(0);
        resetAttempts();
        setAttemptsState(0);
        setInfo("Bloqueo levantado. Puedes intentar nuevamente.");
      } else {
        setInfo((s) => s); // trigger repaint
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  // Input seguro
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length <= 6) {
      setPin(v);
      setError("");
      setInfo("");
    }
  };
  const handlePreventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => e.preventDefault();
  const handlePreventDrop = (e: React.DragEvent<HTMLInputElement>) => e.preventDefault();

  const keypadClick = (d: string) => {
    if (pin.length < 6) {
      setPin((p) => (p + d).replace(/\D/g, ""));
      setError("");
      setInfo("");
    }
  };
  const handleClearPin = () => {
    setPin("");
    setError("");
    setInfo("");
    inputRef.current?.focus();
  };

  const remaining = Math.max(0, lockUntil - now());
  const lockMsg = useMemo(() => {
    if (remaining <= 0) return "";
    const mm = minutes(remaining);
    const ss = seconds(remaining);
    return mm > 0 ? `Bloqueado por seguridad. Intenta en ${mm} min ${ss}s.` : `Bloqueado por seguridad. Intenta en ${ss}s.`;
  }, [remaining]);
  const isLocked = remaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (isLocked) {
      setError(lockMsg || "Bloqueado por seguridad. Intenta más tarde.");
      return;
    }

    const last = parseInt(localStorage.getItem(LS.LAST_TRY) || "0", 10);
    const since = now() - last;
    if (since < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - since) / 1000);
      setError(`Demasiados intentos seguidos. Espera ${wait}s y vuelve a intentar.`);
      return;
    }
    localStorage.setItem(LS.LAST_TRY, String(now()));

    if (!pin.trim()) return;

    setIsLoading(true);
    try {
      const success = await login(pin);
      if (success) {
        resetAttempts();
        clearLock();
        setAttemptsState(0);
        setLockUntilState(0);
        markAdminSession(); // admin_auth + expiración
        setInfo("Acceso concedido. Redirigiendo…");
        return;
      }

      const next = getAttempts() + 1;
      setAttempts(next);
      setAttemptsState(next);

      if (next >= MAX_ATTEMPTS) {
        const rounds = Math.floor(next / MAX_ATTEMPTS);
        const minutesLock = BASE_LOCK_MINUTES * Math.pow(2, rounds - 1);
        const until = now() + minutesLock * 60 * 1000;
        setLockUntil(until);
        setLockUntilState(until);
        setError(`PIN incorrecto. Se ha activado un bloqueo de ${minutesLock} minutos.`);
      } else {
        setError(`PIN incorrecto. Intentos: ${next}/${MAX_ATTEMPTS}.`);
      }

      setPin("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Login error:", err);
      setError("Error de conexión. Verifica tu internet e inténtalo otra vez.");
    } finally {
      setIsLoading(false);
    }
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
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Acceso Administrativo
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {(error || info || isLocked) && (
              <Alert variant={error ? "destructive" : "default"}>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error || info || lockMsg}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de Acceso</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    ref={inputRef}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={handlePinChange}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    placeholder="Ingresa tu PIN"
                    className="text-center text-xl tracking-widest pr-10"
                    autoFocus
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPin((s) => !s)}
                    disabled={isLoading}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg bg-gradient-to-r from-primary to-primary-light"
                disabled={!pin.trim() || isLoading || isLocked}
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

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  className="h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => keypadClick(String(d))}
                  disabled={isLoading || isLocked}
                >
                  {d}
                </Button>
              ))}

              <Button
                type="button"
                variant="outline"
                className="h-12 text-lg font-semibold hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={handleClearPin}
                disabled={isLoading || isLocked}
              >
                Borrar
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => keypadClick("0")}
                disabled={isLoading || isLocked}
              >
                0
              </Button>

              <Button
                type="submit"
                variant="default"
                className="h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground"
                disabled={!pin.trim() || isLoading || isLocked}
                onClick={handleSubmit}
              >
                ✓
              </Button>
            </div>

            {/* Demo – elimínalo en producción */}
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
}

export default RTDBLogin;

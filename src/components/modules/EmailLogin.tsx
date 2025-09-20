// src/components/modules/EmailLogin.tsx
import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/rtdb";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function EmailLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      // Inicia sesión; bindAuth() en App.tsx actualizará el user/rol
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      setMsg("Inicio de sesión correcto.");
    } catch (e: any) {
      const code = String(e?.code || "");
      let friendly = "Error de inicio de sesión";
      if (code.includes("auth/invalid-credential")) friendly = "Correo o contraseña inválidos.";
      if (code.includes("auth/user-not-found")) friendly = "Usuario no encontrado.";
      if (code.includes("auth/wrong-password")) friendly = "Contraseña incorrecta.";
      if (code.includes("auth/too-many-requests")) friendly = "Demasiados intentos. Intenta luego.";
      setErr(friendly);
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    setMsg(null);
    setErr(null);
    const val = email.trim();
    if (!val) {
      setErr("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, val);
      setMsg("Te enviamos un enlace para restablecer tu contraseña.");
    } catch (e: any) {
      const code = String(e?.code || "");
      let friendly = "No se pudo enviar el correo de recuperación.";
      if (code.includes("auth/user-not-found")) friendly = "Ese correo no tiene cuenta registrada.";
      setErr(friendly);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Correo</label>
        <input
          type="email"
          className="w-full border rounded-md px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@tuemail.com"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Contraseña</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            className="w-full border rounded-md px-3 py-2 pr-10"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {msg && <p className="text-emerald-700 text-sm">{msg}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 text-white py-2 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          "Ingresar"
        )}
      </button>

      <div className="text-right">
        <button
          type="button"
          onClick={onResetPassword}
          className="text-sm text-emerald-700 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </form>
  );
}

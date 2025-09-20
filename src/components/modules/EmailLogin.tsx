// src/components/modules/EmailLogin.tsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/rtdb";

export default function EmailLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      // si el correo está permitido en tus reglas, tendrá acceso
    } catch (e: any) {
      setErr(e?.message || "Error de inicio de sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-4">
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
        <input
          type="password"
          className="w-full border rounded-md px-3 py-2"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 text-white py-2 disabled:opacity-50"
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}

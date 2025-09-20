// src/components/modules/FamilyLogin.tsx
import { useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Props = {
  onLogged: (client: { code: string; name: string }) => void;
};

export default function FamilyLogin({ onLogged }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const clean = code.trim();
    if (!clean) return setErr("Ingrese el código de su hijo(a).");

    setLoading(true);
    try {
      const path = `${RTDB_PATHS.clients}/${clean}`;
      const data = await RTDBHelper.getData<any>(path);
      if (!data || data?.active === false) {
        setErr("Código no válido o inactivo.");
      } else {
        const name = data?.name || data?.fullName || "Estudiante";
        onLogged({ code: clean, name });
      }
    } catch (e: any) {
      setErr("No se pudo validar el código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Ingresar código del estudiante</h2>
      <p style={{ color: "#6b7280" }}>
        Escriba el <b>código único</b> (por ejemplo: <code>C169111</code>) para acceder al menú.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código (ej. C169111)"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #10b981",
            background: loading ? "#a7f3d0" : "#10b981",
            color: "white",
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          {loading ? "Validando…" : "Entrar"}
        </button>
      </form>

      {err && <p style={{ color: "#b91c1c", marginTop: 10 }}>{err}</p>}
    </section>
  );
}
